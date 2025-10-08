import { File } from '@fastify/multipart';
import { fromBuffer } from 'file-type';
import mime from 'mime-types';

export const validateMimeAndMagic = async (file: File, allowed: string[]) => {
  const buffer = await file.toBuffer();
  const type = await fromBuffer(buffer);
  if (!type || !allowed.includes(type.mime)) {
    throw new Error('Nieprawidłowy typ pliku');
  }
  const extension = mime.extension(type.mime);
  if (!extension) {
    throw new Error('Nieznane rozszerzenie pliku');
  }
  return { buffer, type };
};

export const clamavScan = async (_buffer: Buffer) => {
  // TODO: Integracja z usługą ClamAV. W środowisku demo pomijamy.
  return true;
};
