/**
 * Majie 码界 — AI 服务
 * 支持 OpenAI / 本地 Ollama 生成 commit message、代码审查
 */
export {};

const https = require('https');
const http = require('http');

// ========== AI 配置 ==========

interface AIConfig {
  provider: 'openai' | 'ollama' | 'custom';
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

let aiConfig: AIConfig = {
  provider: 'openai',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  maxTokens: 256,
  temperature: 0.3,
};

/** Ollama 默认配置 */
const OLLAMA_DEFAULT: Partial<AIConfig> = {
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  apiKey: '',
  model: 'qwen2.5-coder:7b',
  maxTokens: 256,
  temperature: 0.3,
};

// ========== HTTP 请求工具 ==========

function request(url: string, options: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: 30000,
    };

    const req = mod.request(reqOptions, (res: any) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(json.error?.message || json.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`解析 AI 响应失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('AI 请求超时')); });
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

// ========== AI 功能 ==========

/**
 * 调用 AI 模型（兼容 OpenAI / Ollama API 格式）
 */
async function chat(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (!aiConfig.apiKey && aiConfig.provider !== 'ollama') {
    throw new Error('AI API Key 未配置。请在设置中填入。');
  }

  const url = aiConfig.provider === 'ollama'
    ? `${aiConfig.baseUrl}/api/chat`
    : `${aiConfig.baseUrl}/chat/completions`;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (aiConfig.apiKey) {
    headers['Authorization'] = `Bearer ${aiConfig.apiKey}`;
  }

  let body: any;

  if (aiConfig.provider === 'ollama') {
    // Ollama API 格式
    body = {
      model: aiConfig.model,
      messages,
      stream: false,
      options: {
        temperature: aiConfig.temperature,
        num_predict: aiConfig.maxTokens,
      },
    };
  } else {
    // OpenAI 兼容格式
    body = {
      model: aiConfig.model,
      messages,
      max_tokens: aiConfig.maxTokens,
      temperature: aiConfig.temperature,
    };
  }

  const result = await request(url, { headers, body });

  if (aiConfig.provider === 'ollama') {
    return result.message?.content || '';
  }

  return result.choices?.[0]?.message?.content || '';
}

/**
 * AI 生成 Commit Message
 * 输入 diff 内容，输出符合 Conventional Commits 规范的提交信息
 */
async function generateCommitMessage(diff: string, language: string = 'zh'): Promise<string> {
  const langHint = language === 'zh'
    ? '用中文描述，但 commit 标题保持英文'
    : 'Write in English';

  const messages = [
    {
      role: 'system',
      content: `你是一个 Git 提交信息生成器。根据代码 diff 生成简洁的 Conventional Commits 格式的提交信息。
规则：
1. 格式: type(scope): description
2. type 只用: feat/fix/refactor/docs/style/test/chore/perf/build/ci
3. scope 可省略
4. description 不超过 72 字符
5. 可选添加 body 详细说明
6. ${langHint}
7. 只输出 commit message，不要任何额外解释`,
    },
    {
      role: 'user',
      content: `请根据以下 diff 生成 commit message:\n\n${diff.substring(0, 4000)}`,
    },
  ];

  return chat(messages);
}

/**
 * AI 代码审查
 * 输入 diff 内容，输出审查意见
 */
async function reviewCode(diff: string, language: string = 'zh'): Promise<string> {
  const langHint = language === 'zh' ? '用中文回复' : 'Reply in English';

  const messages = [
    {
      role: 'system',
      content: `你是一个专业的代码审查助手。审查代码变更，给出简洁的改进建议。
关注：
1. 潜在 bug 或逻辑错误
2. 安全隐患
3. 性能问题
4. 代码风格和可维护性
5. 缺失的边界条件处理

${langHint}
输出格式：
- 🔴 严重问题（如果有）
- 🟡 建议改进（如果有）
- 🟢 亮点（如果有）
保持简洁，每条不超过 2 句。`,
    },
    {
      role: 'user',
      content: `请审查以下代码变更:\n\n${diff.substring(0, 6000)}`,
    },
  ];

  return chat(messages);
}

/**
 * AI 解释代码
 */
async function explainCode(code: string, language: string = 'zh'): Promise<string> {
  const langHint = language === 'zh' ? '用中文解释' : 'Explain in English';

  const messages = [
    {
      role: 'system',
      content: `你是代码解释助手。${langHint}。简洁说明代码逻辑，不超过 5 句。`,
    },
    {
      role: 'user',
      content: code.substring(0, 4000),
    },
  ];

  return chat(messages);
}

// ========== 配置管理 ==========

function setConfig(config: Partial<AIConfig>): void {
  aiConfig = { ...aiConfig, ...config };
}

function getConfig(): AIConfig {
  return { ...aiConfig };
}

/** 快速切换为 Ollama 本地模式 */
function useOllama(model?: string): void {
  aiConfig = { ...aiConfig, ...OLLAMA_DEFAULT, model: model || OLLAMA_DEFAULT.model! };
}

/** 检查是否配置了 AI */
function isConfigured(): boolean {
  return aiConfig.provider === 'ollama' || !!aiConfig.apiKey;
}

/** 测试连接 */
async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const result = await chat([
      { role: 'user', content: 'Say "OK" and nothing else.' },
    ]);
    return { success: true, message: `连接成功，模型: ${aiConfig.model}` };
  } catch (e: any) {
    return { success: false, message: e.message };
  }
}

module.exports = {
  generateCommitMessage,
  reviewCode,
  explainCode,
  setConfig,
  getConfig,
  useOllama,
  isConfigured,
  testConnection,
};
