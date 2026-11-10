import { upload } from '@vercel/blob/client';

/**
 * Uploads a resume from the browser straight to blob storage, then registers
 * it with us.
 *
 * The file never passes through our own API, which is what removes Vercel's
 * 4.5 MB request body limit - the limit that produced the bare "Failed to
 * fetch" a candidate saw with no way to tell what went wrong.
 *
 * The path is proposed here and checked server-side against what this caller
 * is actually entitled to write.
 */

export type ResumeUpload = {
  blobUrl: string;
  documentId: string;
  parseStatus: 'OK' | 'SKIPPED' | 'FAILED' | string;
  /** Set when the file was stored but its text could not be read. */
  message: string | null;
};

export const RESUME_MAX_BYTES = 25 * 1024 * 1024;

export function resumeFileProblem(file: File): string | null {
  const lower = file.name.toLowerCase();
  const allowed =
    file.type === 'application/pdf' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.docx');

  if (!allowed) return 'Please choose a PDF or DOCX file.';
  if (file.size > RESUME_MAX_BYTES) {
    return `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`;
  }
  if (file.size === 0) return 'That file is empty.';
  return null;
}

function safeName(fileName: string): string {
  const ext = fileName.toLowerCase().endsWith('.docx') ? 'docx' : 'pdf';
  const base =
    fileName
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .toLowerCase() || 'resume';
  return `${base}.${ext}`;
}

export async function uploadResume(
  file: File,
  options: { prefix: string; inviteToken?: string | null } = { prefix: 'intake/resumes' }
): Promise<ResumeUpload> {
  const problem = resumeFileProblem(file);
  if (problem) throw new Error(problem);

  const clientPayload = options.inviteToken
    ? JSON.stringify({ inviteToken: options.inviteToken })
    : undefined;

  const blob = await upload(`${options.prefix}/${Date.now()}-${safeName(file.name)}`, file, {
    access: 'public',
    handleUploadUrl: '/api/uploads/grant',
    contentType: file.type || 'application/pdf',
    clientPayload,
  });

  const res = await fetch('/api/uploads/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      blobUrl: blob.url,
      fileName: file.name,
      inviteToken: options.inviteToken ?? undefined,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'The upload could not be saved.');

  return {
    blobUrl: data.blobUrl,
    documentId: data.documentId,
    parseStatus: data.parseStatus,
    message: data.message ?? null,
  };
}
