import { head } from '@vercel/blob';
import {
  prefixForScope,
  type StorageAdapter,
  type StoredObject,
  type UploadScope,
} from './types';

/** The default. Uploads go browser-to-blob; we only ever ask what landed. */
export const vercelBlobAdapter: StorageAdapter = {
  provider: 'VERCEL_BLOB',

  prefixFor(scope: UploadScope): string {
    return prefixForScope(scope);
  },

  async describe(url: string): Promise<StoredObject> {
    const meta = await head(url);
    return {
      pathname: meta.pathname,
      contentType: meta.contentType ?? 'application/octet-stream',
      byteSize: meta.size,
    };
  },

  async read(url: string): Promise<ArrayBuffer> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Could not download the file (${res.status}).`);
    }
    return res.arrayBuffer();
  },
};
