/** Checks resume extraction against a real file. */
import { readFileSync } from 'fs';
import { extractResumeText } from '../src/lib/resume-parse';

async function main() {
  for (const path of process.argv.slice(2)) {
    const buf = readFileSync(path);
    const type = path.endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';
    const out = await extractResumeText(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
      type,
      path
    );
    console.log(`\n${path}\n  status: ${out.status}`);
    if (out.error) console.log(`  note:   ${out.error}`);
    if (out.text) console.log(`  chars:  ${out.text.length}\n  text:   ${out.text.slice(0, 220).replace(/\n/g, ' ')}…`);
  }
}
main();
