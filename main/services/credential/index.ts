/**
 * 凭证服务
 * 使用 Electron safeStorage + 本地加密文件存储凭证
 * 无需原生依赖（替代 keytar），跨平台兼容
 */
export {};

const { safeStorage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/** 凭证信息 */
interface Credential {
  /** 协议（http 或 https） */
  protocol: 'http' | 'https';
  /** 主机名 */
  host: string;
  /** 用户名 */
  username: string;
  /** 密码/令牌 */
  password: string;
}

/** 存储的凭证条目 */
interface StoredCredential {
  protocol: string;
  host: string;
  username: string;
  /** 加密后的密码（base64） */
  encryptedPassword: string;
}

/** 凭证服务类 */
class CredentialService {
  private serviceName = 'GitGUI';
  private storePath: string;

  constructor() {
    const userDataDir = path.join(os.homedir(), '.gitgui');
    this.storePath = path.join(userDataDir, 'credentials.enc.json');

    // 确保目录存在
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }
  }

  /**
   * 读取所有存储的凭证
   */
  private readStore(): StoredCredential[] {
    if (!fs.existsSync(this.storePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.storePath, 'utf-8');
      return JSON.parse(content) as StoredCredential[];
    } catch {
      return [];
    }
  }

  /**
   * 写入凭证存储
   */
  private writeStore(credentials: StoredCredential[]): void {
    fs.writeFileSync(this.storePath, JSON.stringify(credentials, null, 2), 'utf-8');
  }

  /**
   * 加密密码
   */
  private encryptPassword(password: string): string {
    if (!safeStorage.isEncryptionAvailable()) {
      // 降级：Base64 编码（不安全，仅开发环境使用）
      console.warn('[CredentialService] safeStorage 不可用，使用 Base64 降级编码');
      return Buffer.from(password, 'utf-8').toString('base64');
    }
    const buffer = safeStorage.encryptString(password);
    return buffer.toString('base64');
  }

  /**
   * 解密密码
   */
  private decryptPassword(encryptedBase64: string): string {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    if (!safeStorage.isEncryptionAvailable()) {
      console.warn('[CredentialService] safeStorage 不可用，使用 Base64 降级解码');
      return buffer.toString('utf-8');
    }
    return safeStorage.decryptString(buffer);
  }

  /**
   * 保存凭证
   */
  async save(credential: Credential): Promise<void> {
    const credentials = this.readStore();
    const key = `${credential.protocol}://${credential.host}`;

    const entry: StoredCredential = {
      protocol: credential.protocol,
      host: credential.host,
      username: credential.username,
      encryptedPassword: this.encryptPassword(credential.password),
    };

    // 替换已有条目
    const index = credentials.findIndex(
      (c) => `${c.protocol}://${c.host}` === key
    );
    if (index >= 0) {
      credentials[index] = entry;
    } else {
      credentials.push(entry);
    }

    this.writeStore(credentials);
  }

  /**
   * 获取凭证
   */
  async get(protocol: 'http' | 'https', host: string): Promise<Credential | null> {
    const credentials = this.readStore();
    const key = `${protocol}://${host}`;
    const entry = credentials.find((c) => `${c.protocol}://${c.host}` === key);

    if (!entry) return null;

    return {
      protocol: entry.protocol as 'http' | 'https',
      host: entry.host,
      username: entry.username,
      password: this.decryptPassword(entry.encryptedPassword),
    };
  }

  /**
   * 删除凭证
   */
  async delete(protocol: 'http' | 'https', host: string): Promise<void> {
    const credentials = this.readStore();
    const key = `${protocol}://${host}`;
    const filtered = credentials.filter((c) => `${c.protocol}://${c.host}` !== key);
    this.writeStore(filtered);
  }

  /**
   * 获取所有保存的凭证主机列表
   */
  async listHosts(): Promise<Array<{ protocol: string; host: string; username: string }>> {
    const credentials = this.readStore();
    return credentials.map((c) => ({
      protocol: c.protocol,
      host: c.host,
      username: c.username,
    }));
  }
}

// 导出单例
const credentialService = new CredentialService();
module.exports = { CredentialService, credentialService };
