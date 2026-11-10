/**
 * Where candidate documents live.
 *
 * The client asked for storage to be configurable so a customer can keep
 * their candidates' resumes in their own bucket rather than ours - not today,
 * but without a rewrite when they ask. So the provider sits behind this
 * interface and the rest of the application never names Vercel Blob.
 *
 * Only the Vercel Blob adapter exists. This interface is the contract an S3
 * or Supabase one would have to meet, and it is deliberately small: a browser
 * upload needs permission to write to one path, and a reader needs to be told
 * what is actually there.
 */

export type StorageProvider = 'VERCEL_BLOB' | 'S3';

/** Who is uploading, which decides where the file may land. */
export type UploadScope =
  | { kind: 'tenant'; clientAccountId: string }
  | { kind: 'practice' }
  | { kind: 'intake' }
  | { kind: 'admin' };

export type StoredObject = {
  pathname: string;
  contentType: string;
  byteSize: number;
};

/**
 * What is behind this interface, and what is not.
 *
 * Reading is: describing an object and fetching its bytes both go through the
 * adapter, so nothing outside src/lib/storage knows which provider is in use.
 *
 * Issuing the upload token is not. Vercel Blob's browser SDK pairs a specific
 * client call with a specific server handler, and pretending otherwise would
 * be an abstraction that only fits one provider. Adding S3 means writing a
 * presigned-POST route beside the existing grant route and selecting between
 * them here - the path convention, the scoping rules and the read side are
 * already shared, which is the part that would otherwise have to be redone.
 *
 * Admin media uploads (logos, backdrops) still write directly. They are not
 * candidate data, which is what the configurable routing is for.
 */
export interface StorageAdapter {
  readonly provider: StorageProvider;

  /**
   * The folder this caller may write to. Returned rather than accepted, so a
   * browser cannot nominate someone else's folder - every adapter has to
   * derive it from the scope alone.
   */
  prefixFor(scope: UploadScope): string;

  /** What storage says is at this URL. Throws if there is nothing. */
  describe(url: string): Promise<StoredObject>;

  /** Fetches the bytes, for text extraction. */
  read(url: string): Promise<ArrayBuffer>;
}

/**
 * Paths are part of the contract, not an implementation detail: the tenant
 * owning a file has to be readable from where it sits, so an object can be
 * attributed, audited and deleted without consulting the database.
 */
export function prefixForScope(scope: UploadScope): string {
  switch (scope.kind) {
    case 'tenant':
      return `tenants/${scope.clientAccountId}/resumes`;
    case 'practice':
      return 'practice/resumes';
    case 'admin':
      return 'admin/resumes';
    case 'intake':
      return 'intake/resumes';
  }
}
