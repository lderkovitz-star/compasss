import { extractText, getDocumentProxy } from 'unpdf';
import * as mammoth from 'mammoth';

/**
 * Reads a candidate's uploaded resume back out of Vercel Blob as plain text, so
 * the evaluation can use what is actually in it. Never throws: a resume that
 * cannot be read must not stop an evaluation, it just goes in as "unreadable".
 */

export type ResumeStatus = 'read' | 'none' | 'unreadable';

const MAX_BYTES = 5 * 1024 * 1024;
// About 1.5k tokens: enough for a full page or two without letting one very long
// resume dominate the prompt.
const MAX_CHARS = 6000;

const UNREADABLE = { status: 'unreadable' as const, text: null };

export async function extractResumeText(
  url: string | null | undefined
): Promise<{ status: ResumeStatus; text: string | null }> {
  if (!url) return { status: 'none', text: null };

  // Not a URL at all (e.g. a path left by seed data): unreadable, not an error.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return UNREADABLE;
  }
  // The URL is written by our own upload routes, but never fetch anything that
  // is not our Blob store.
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.blob.vercel-storage.com')) {
    return UNREADABLE;
  }

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return UNREADABLE;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_BYTES) return UNREADABLE;

    const path = parsed.pathname.toLowerCase();
    let text: string;
    if (path.endsWith('.pdf')) {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (path.endsWith('.docx')) {
      text = (await mammoth.extractRawText({ buffer })).value;
    } else {
      return UNREADABLE;
    }

    text = text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    // A scanned PDF has pages but no text layer.
    if (!text) return UNREADABLE;

    return { status: 'read', text: text.slice(0, MAX_CHARS) };
  } catch (err) {
    console.error('[resume-text]', err);
    return UNREADABLE;
  }
}
