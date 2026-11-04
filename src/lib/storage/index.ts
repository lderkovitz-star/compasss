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

/**
 * Vercel Blob tokens look like `vercel_blob_rw_<store>_<secret>`. The SDK's
 * own complaint for a bad one is "Invalid `token` parameter", which does not
 * say whether the variable is missing, truncated, or wrapped in quotes - and
 * those are the three ways it actually goes wrong when someone pastes it into
 * a dashboard.
 */
export function describeBlobToken(): string | null {
  const raw = process.env.BLOB_READ_WRITE_TOKEN;
  if (!raw) {
    return 'BLOB_READ_WRITE_TOKEN is not set for this environment. Vercel often adds it to Production only - tick Preview on the existing variable.';
  }
  const value = raw.trim();
  if (/^["']|["']$/.test(value)) {
    return 'BLOB_READ_WRITE_TOKEN has quotes around it. The value is stored literally, so paste it without them.';
  }
  if (!value.startsWith('vercel_blob_rw_')) {
    return `BLOB_READ_WRITE_TOKEN does not start with "vercel_blob_rw_", so it is not a Blob read-write token. Copy it from the Blob store's .env.local tab.`;
  }
  if (value.length < 50) {
    return `BLOB_READ_WRITE_TOKEN is only ${value.length} characters, which is too short - it looks truncated. Copy the whole value.`;
  }
  return null;
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
