import crypto from 'crypto';

export interface FileDescriptor {
  key: string;
  buffer: Buffer;
  contentType: string;
}

export interface FileStorage {
  upload: (descriptor: FileDescriptor) => Promise<string>;
  getSignedUrl: (key: string) => Promise<string>;
}

class InMemoryFileStorage implements FileStorage {
  private storage = new Map<string, Buffer>();

  async upload(descriptor: FileDescriptor): Promise<string> {
    const key = descriptor.key || crypto.randomUUID();
    this.storage.set(key, descriptor.buffer);
    return key;
  }

  async getSignedUrl(key: string): Promise<string> {
    if (!this.storage.has(key)) {
      throw new Error('Brak pliku');
    }
    return `memory://${key}`;
  }
}

export const fileStorage: FileStorage = new InMemoryFileStorage();

export const createStorageKey = (prefix: string, filename: string) =>
  `${prefix}/${crypto.randomUUID()}-${filename}`;
