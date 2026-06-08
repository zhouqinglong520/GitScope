/**
 * Majie 码界 — Gitee 集成服务
 * OAuth 授权 + API 调用：MR/PR 管理、仓库浏览、CI/CD 状态
 */
export {};

const https = require('https');
const http = require('http');

// ========== OAuth 配置 ==========

/** Gitee OAuth 应用配置（Majie 内置） */
const GITEE_OAUTH = {
  clientId: '',       // 需在 Gitee 开发者设置创建应用后填入
  clientSecret: '',   // 同上
  redirectUri: 'http://localhost:17892/callback',
  authUrl: 'https://gitee.com/oauth/authorize',
  tokenUrl: 'https://gitee.com/oauth/token',
  scope: 'projects pull_requests issues',
};

interface GiteeToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  createdAt: number;
  scope: string;
}

interface GiteeUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
}

interface GiteePullRequest {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  user: { login: string; avatar_url: string };
  head: { ref: string; sha: string; label: string };
  base: { ref: string; sha: string; label: string };
  created_at: string;
  updated_at: string;
  mergeable: boolean | null;
  merged: boolean;
  labels: Array<{ name: string; color: string }>;
}

interface GiteeRepo {
  id: number;
  full_name: string;
  name: string;
  html_url: string;
  description: string;
  private: boolean;
  fork: boolean;
  default_branch: string;
}

/** Token 缓存 */
let cachedToken: GiteeToken | null = null;

// ========== HTTP 请求工具 ==========

function request(url: string, options: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Majie-GitGUI/1.0',
        ...options.headers,
      },
    };

    const req = mod.request(reqOptions, (res: any) => {
      let data = '';
      res.on('data', (chunk: string) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(json.message || `HTTP ${res.statusCode}`));
          } else {
            resolve(json);
          }
        } catch {
          reject(new Error(`解析响应失败: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

/** 带 Token 的 API 请求 */
async function apiRequest(path: string, options: Record<string, any> = {}): Promise<any> {
  if (!cachedToken) throw new Error('Gitee 未授权，请先完成 OAuth 登录');
  const url = `https://gitee.com/api/v5${path}`;
  const separator = path.includes('?') ? '&' : '?';
  const fullUrl = `${url}${separator}access_token=${cachedToken.accessToken}`;
  return request(fullUrl, options);
}

// ========== OAuth 流程 ==========

/**
 * 生成 OAuth 授权 URL
 */
function getAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GITEE_OAUTH.clientId,
    redirect_uri: GITEE_OAUTH.redirectUri,
    scope: GITEE_OAUTH.scope,
    response_type: 'code',
  });
  return `${GITEE_OAUTH.authUrl}?${params.toString()}`;
}

/**
 * 启动本地 HTTP 服务器接收 OAuth 回调
 */
function startOAuthServer(): Promise<string> {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const server = http.createServer((req: any, res: any) => {
      const parsed = new URL(req.url, `http://localhost:17892`);
      if (parsed.pathname === '/callback') {
        const code = parsed.searchParams.get('code');
        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><h2>✅ 授权成功！</h2><p>可以关闭此页面，回到 Majie 码界。</p><script>window.close()</script></body></html>');
          server.close();
          resolve(code);
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end('<html><body><h2>❌ 授权失败</h2><p>未收到授权码。</p></body></html>');
          server.close();
          reject(new Error('未收到授权码'));
        }
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(17892, () => {
      console.log('[Gitee] OAuth 回调服务器启动在端口 17892');
    });

    // 60 秒超时
    setTimeout(() => {
      server.close();
      reject(new Error('OAuth 授权超时'));
    }, 60000);
  });
}

/**
 * 用授权码换取 Token
 */
async function exchangeToken(code: string): Promise<GiteeToken> {
  const result = await request(GITEE_OAUTH.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: {
      grant_type: 'authorization_code',
      code,
      client_id: GITEE_OAUTH.clientId,
      redirect_uri: GITEE_OAUTH.redirectUri,
      client_secret: GITEE_OAUTH.clientSecret,
    },
  });

  cachedToken = {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresIn: result.expires_in,
    createdAt: result.created_at,
    scope: result.scope,
  };

  return cachedToken;
}

/**
 * 刷新 Token
 */
async function refreshToken(): Promise<GiteeToken> {
  if (!cachedToken?.refreshToken) throw new Error('无 refresh token');
  const result = await request(GITEE_OAUTH.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
    body: {
      grant_type: 'refresh_token',
      refresh_token: cachedToken.refreshToken,
    },
  });

  cachedToken = {
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    expiresIn: result.expires_in,
    createdAt: result.created_at,
    scope: result.scope,
  };

  return cachedToken;
}

/**
 * 完整 OAuth 登录流程
 */
async function login(): Promise<{ token: GiteeToken; user: GiteeUser }> {
  if (!GITEE_OAUTH.clientId) {
    throw new Error('Gitee OAuth 未配置。请在设置中填入 Client ID 和 Client Secret。');
  }

  const authUrl = getAuthUrl();
  const { shell } = require('electron');
  await shell.openExternal(authUrl);

  const code = await startOAuthServer();
  const token = await exchangeToken(code);
  const user = await getCurrentUser();

  return { token, user };
}

/**
 * 登出
 */
function logout(): void {
  cachedToken = null;
}

// ========== Gitee API 封装 ==========

/**
 * 获取当前用户信息
 */
async function getCurrentUser(): Promise<GiteeUser> {
  return apiRequest('/user');
}

/**
 * 获取仓库的 Pull Request 列表
 */
async function listPullRequests(owner: string, repo: string, state: string = 'open'): Promise<GiteePullRequest[]> {
  return apiRequest(`/repos/${owner}/${repo}/pulls?state=${state}&sort=updated&direction=desc&per_page=30`);
}

/**
 * 获取 PR 详情
 */
async function getPullRequest(owner: string, repo: string, number: number): Promise<GiteePullRequest> {
  return apiRequest(`/repos/${owner}/${repo}/pulls/${number}`);
}

/**
 * 创建 Pull Request
 */
async function createPullRequest(
  owner: string, repo: string,
  title: string, body: string,
  head: string, base: string
): Promise<GiteePullRequest> {
  return apiRequest(`/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    body: { title, body, head, base },
  });
}

/**
 * 合并 Pull Request
 */
async function mergePullRequest(owner: string, repo: string, number: number): Promise<any> {
  return apiRequest(`/repos/${owner}/${repo}/pulls/${number}/merge`, {
    method: 'PUT',
  });
}

/**
 * 获取用户的仓库列表
 */
async function listRepos(page: number = 1, perPage: number = 30): Promise<GiteeRepo[]> {
  return apiRequest(`/user/repos?page=${page}&per_page=${perPage}&sort=updated`);
}

/**
 * 从 remote URL 解析 owner/repo
 */
function parseRepoFromRemote(remoteUrl: string): { owner: string; repo: string } | null {
  // SSH: git@gitee.com:owner/repo.git
  const sshMatch = remoteUrl.match(/git@gitee\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) return { owner: sshMatch[1], repo: sshMatch[2] };

  // HTTPS: https://gitee.com/owner/repo.git
  const httpsMatch = remoteUrl.match(/https?:\/\/gitee\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) return { owner: httpsMatch[1], repo: httpsMatch[2] };

  return null;
}

/**
 * 检查是否已授权
 */
function isLoggedIn(): boolean {
  if (!cachedToken) return false;
  // 检查是否过期
  if (cachedToken.createdAt + cachedToken.expiresIn < Date.now() / 1000) {
    return false;
  }
  return true;
}

/**
 * 设置保存的 Token（启动时从 safeStorage 恢复）
 */
function setToken(token: GiteeToken): void {
  cachedToken = token;
}

/**
 * 获取当前 Token（用于持久化存储）
 */
function getToken(): GiteeToken | null {
  return cachedToken;
}

/**
 * 设置 OAuth 配置
 */
function setOAuthConfig(clientId: string, clientSecret: string): void {
  GITEE_OAUTH.clientId = clientId;
  GITEE_OAUTH.clientSecret = clientSecret;
}

module.exports = {
  login,
  logout,
  isLoggedIn,
  getCurrentUser,
  listPullRequests,
  getPullRequest,
  createPullRequest,
  mergePullRequest,
  listRepos,
  parseRepoFromRemote,
  setToken,
  getToken,
  setOAuthConfig,
  getAuthUrl,
};
