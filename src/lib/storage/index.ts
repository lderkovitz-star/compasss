import { prisma } from '../db';
import { vercelBlobAdapter } from './vercel-blob';
import type { StorageAdapter, StorageProvider } from './types';

export * from './types';

/**
 * Picks the configured adapter.
 *
 * The setting is read at request time rather than at boot, so moving a
 * deployment onto a customer's own bucket is a settings change and not a
 * redeploy - which was the point of making it configurable.
 */
const ADAPTERS: Partial<Record<StorageProvider, StorageAdapter>> = {
  VERCEL_BLOB: vercelBlobAdapter,
};

/** Configuration the operator has to fix, as opposed to a request that failed. */
export class StorageConfigError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, StorageConfigError.prototype);
    this.name = 'StorageConfigError';
  }
}

export async function getStorage(): Promise<StorageAdapter> {
  let configured: string | null = null;
  try {
    const settings = await prisma.platformSettings.findFirst({
      select: { storageProvider: true },
    });
    configured = settings?.storageProvider ?? null;
  } catch {
    // An upload should not fail because the settings row could not be read.
  }

  const provider = (configured ?? process.env.STORAGE_PROVIDER ?? 'VERCEL_BLOB') as StorageProvider;
  const adapter = ADAPTERS[provider];

  if (!adapter) {
    // Naming the gap beats failing somewhere further down with a less useful
    // message - S3 is the one that does not exist yet.
    throw new StorageConfigError(
      `Storage provider "${provider}" is configured but has no adapter. Only ${Object.keys(ADAPTERS).join(', ')} is implemented.`
    );
  }

  return adapter;
}
