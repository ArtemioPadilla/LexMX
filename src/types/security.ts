// Security and encryption types

export interface EncryptedData {
  data: number[];
  iv: number[];
  algorithm: string;
  version: number;
}

export interface SecurityConfig {
  encryptionAlgorithm: string;
  keyDerivationRounds: number;
  saltLength: number;
  ivLength: number;
}

export interface SecureStorage {
  store(key: string, data: any): Promise<void>;
  retrieve(key: string): Promise<any | null>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export interface CryptoManager {
  generateKey(password?: string): Promise<CryptoKey>;
  encrypt(data: string, key: CryptoKey): Promise<EncryptedData>;
  decrypt(encryptedData: EncryptedData, key: CryptoKey): Promise<string>;
  hash(data: string): Promise<string>;
  generateFingerprint(): Promise<string>;
}

export interface PrivacySettings {
  encryptTokens: boolean;
  encryptQueries: boolean;
  encryptResponses: boolean;
  clearDataOnExit: boolean;
  sessionOnly: boolean;
  analytics: 'none' | 'anonymous' | 'full';
}

export interface AuditLog {
  timestamp: number;
  action: string;
  provider?: string;
  model?: string;
  tokenCount?: number;
  cost?: number;
  error?: string;
}