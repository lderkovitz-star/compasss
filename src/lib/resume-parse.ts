/**
 * Resume text extraction.
 *
 * Resumes were being uploaded and never read - the evaluation prompt saw only
 * aggregate trait numbers, so the document the candidate took the trouble to
 * attach had no effect on anything. This pulls the text out so it can be put
 * in front of the model.
 *
 * `unpdf` is used for PDF rather than `pdf-parse`, which reads a test fixture
 * from disk at import time and breaks under a bundler. OCR for scanned PDFs is
 * out of scope: a scan extracts nothing, which is reported as SKIPPED rather
 * than passed off as an empty resume.
 */

export type ParseOutcome = {
  status: 'OK' | 'SKIPPED' | 'FAILED';
  text: string | null;
  error: string | null;
};

/** Below this there is nothing worth sending to a model. */
const MIN_USEFUL_CHARS = 200;
/** Enough for a long CV; keeps one document from crowding out the prompt. */
const MAX_STORED_CHARS = 60_000;

export function isSupportedResume(contentType: string, fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return (
    contentType === 'application/pdf' ||
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.pdf') ||
    lower.endsWith('.docx')
  );
}

function tidy(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

export async function extractResumeText(
  buffer: ArrayBuffer,
  contentType: string,
  fileName: string
): Promise<ParseOutcome> {
  const lower = fileName.toLowerCase();
  const isPdf = contentType === 'application/pdf' || lower.endsWith('.pdf');
  const isDocx =
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx');

  if (!isPdf && !isDocx) {
    return { status: 'SKIPPED', text: null, error: 'Only PDF and DOCX files can be read.' };
  }

  try {
    let text: string;

    if (isPdf) {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const result = await extractText(pdf, { mergePages: true });
      text = Array.isArray(result.text) ? result.text.join('\n') : result.text;
    } else {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
      text = result.value;
    }

    const cleaned = tidy(text);

    if (cleaned.length < MIN_USEFUL_CHARS) {
      return {
        status: 'SKIPPED',
        text: cleaned || null,
        error:
          'This file is not machine-readable - it is most likely a scan or an image. The text could not be used.',
      };
    }

    return {
      status: 'OK',
      text: cleaned.slice(0, MAX_STORED_CHARS),
      error: null,
    };
  } catch (err) {
    return {
      status: 'FAILED',
      text: null,
      error: err instanceof Error ? err.message : 'The file could not be read.',
    };
  }
}
