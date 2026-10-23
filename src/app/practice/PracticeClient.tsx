'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { uploadResume, RESUME_MAX_BYTES, resumeFileProblem } from '@/lib/upload-resume';

/**
 * The public sandbox.
 *
 * Nothing here belongs to an employer: the sitting is created with no tenant,
 * so it is excluded from every employer ledger by construction rather than by
 * a filter someone has to remember. Joining the talent registry is opt-in and
 * off by default, and the page says plainly what each choice means.
 */
export default function PracticeClient({
  platformName,
  packageName,
  scenarioCount,
}: {
  platformName: string;
  packageName: string;
  scenarioCount: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [jobText, setJobText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [registryOptIn, setRegistryOptIn] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stage, setStage] = useState('');
  const [loading, setLoading] = useState(false);

  function handleFile(f: File | null) {
    if (!f) return;
    const problem = resumeFileProblem(f);
    if (problem) {
      setError(problem);
      return;
    }
    setFile(f);
    setError('');
  }

  async function begin() {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      let resumeDocumentId: string | undefined;
      if (file) {
        setStage('Uploading your resume…');
        const uploaded = await uploadResume(file, { prefix: 'intake/resumes' });
        resumeDocumentId = uploaded.documentId;
        if (uploaded.message) setNotice(uploaded.message);
      }

      setStage('Setting up your practice run…');
      const res = await fetch('/api/practice/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobText: jobText.trim() || undefined,
          registryOptIn,
          name: registryOptIn ? name.trim() : undefined,
          email: registryOptIn ? email.trim() : undefined,
          resumeDocumentId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'The practice run could not be started.');
      router.push(`/assessment/${data.sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
      setStage('');
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1220] text-[#F3F5FA] px-4 py-10 sm:py-16">
      <div className="max-w-xl mx-auto">
        <Link href="/" className="text-[13px] font-medium text-[#97A2BE] hover:text-white">
          ← {platformName}
        </Link>

        <h1 className="mt-5 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
          Take a practice run
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-[#97A2BE]">
          {scenarioCount} scenario{scenarioCount === 1 ? '' : 's'} from {packageName}. You will be
          put under time pressure and asked to decide with incomplete information. Nothing you do
          here reaches any employer, and no result is shown to anyone unless you ask for it below.
        </p>

        {error && (
          <div className="mt-5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="mt-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-200">
            {notice}
          </div>
        )}

        <div className="mt-7 space-y-6">
          <div>
            <label htmlFor="jobText" className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B8CFF]">
              The role you have in mind
              <span className="ml-2 font-normal tracking-normal text-[#5B6580] normal-case">Optional</span>
            </label>
            <textarea
              id="jobText"
              value={jobText}
              onChange={(e) => setJobText(e.target.value)}
              rows={5}
              maxLength={8000}
              placeholder="Paste a job description, or describe the role in your own words."
              className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3.5 py-3 text-[14px] text-white placeholder:text-[#5B6580] focus:border-[#5B8CFF] focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-[#5B6580]">
              Used to frame the write-up at the end. It changes nothing about the scenarios you see.
            </p>
          </div>

          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B8CFF]">
              Your resume
              <span className="ml-2 font-normal tracking-normal text-[#5B6580] normal-case">Optional</span>
            </span>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`mt-2 cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                dragging ? 'border-[#5B8CFF] bg-[#5B8CFF]/10' : 'border-white/10 hover:border-white/20'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx,application/pdf"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <>
                  <p className="text-[13px] font-medium text-white truncate">{file.name}</p>
                  <p className="mt-1 text-xs text-[#5B6580]">
                    {(file.size / 1024).toFixed(0)} KB · click to choose a different file
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-medium text-white">Drop a PDF or DOCX here</p>
                  <p className="mt-1 text-xs text-[#5B6580]">
                    or click to choose one · up to {Math.round(RESUME_MAX_BYTES / 1024 / 1024)} MB
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <label className="flex gap-3 items-start cursor-pointer">
              <input
                type="checkbox"
                checked={registryOptIn}
                onChange={(e) => setRegistryOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="block text-[14px] font-medium text-white">
                  Join the Continental Talent Registry
                </span>
                <span className="mt-1 block text-[13px] leading-relaxed text-[#97A2BE]">
                  Your result is kept and can be surfaced to employers searching the registry. Leave
                  this unticked and your run is used for nothing and deleted after 30 days.
                </span>
              </span>
            </label>

            {registryOptIn && (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="block text-xs text-[#97A2BE]">
                    Your name
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-[14px] text-white focus:border-[#5B8CFF] focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-xs text-[#97A2BE]">
                    Your email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-white/10 bg-[#0B1220] px-3 py-2 text-[14px] text-white focus:border-[#5B8CFF] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          <button
            onClick={begin}
            disabled={loading}
            className="w-full rounded-xl bg-[#2E63F6] py-4 text-[14.5px] font-semibold text-white transition-colors hover:bg-[#5B8CFF] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? stage || 'Starting…' : 'Start the practice run'}
          </button>
        </div>
      </div>
    </main>
  );
}
