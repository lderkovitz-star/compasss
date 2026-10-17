'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { uploadResume, RESUME_MAX_BYTES } from '@/lib/upload-resume';

export default function AssessInviteClient({
  token,
  companyName,
  candidateName,
  roleName,
  packageName,
  platformName,
  resuming,
  uploadPrefix,
}: {
  token: string;
  companyName: string;
  candidateName: string;
  roleName: string | null;
  packageName: string | null;
  platformName: string;
  resuming: boolean;
  /** Where this candidate's upload is allowed to land; checked server-side. */
  uploadPrefix: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [stage, setStage] = useState('');
  const [loading, setLoading] = useState(false);

  function handleFile(f: File | null) {
    if (!f) return;
    const nameLower = f.name.toLowerCase();
    const allowed =
      ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(
        f.type
      ) || nameLower.endsWith('.pdf') || nameLower.endsWith('.docx');

    if (!allowed) {
      setError('Please upload a PDF or DOCX file.');
      return;
    }
    if (f.size > RESUME_MAX_BYTES) {
      setError(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is 25 MB.`);
      return;
    }
    setFile(f);
    setError('');
  }

  async function begin() {
    setError('');
    setLoading(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    try {
      // The resume goes straight to storage from here, so the request below
      // stays small whatever the file size.
      let resumeDocumentId: string | undefined;
      if (file) {
        setStage('Uploading your resume…');
        const uploaded = await uploadResume(file, { prefix: uploadPrefix, inviteToken: token });
        resumeDocumentId = uploaded.documentId;
        if (uploaded.message) setNotice(uploaded.message);
      }

      setStage('Preparing your assessment…');
      const res = await fetch('/api/assess/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, resumeDocumentId }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      let json: { sessionId?: string; error?: string } = {};
      try {
        json = await res.json();
      } catch {
        // Fall through to the status-based message below.
      }

      if (!res.ok) throw new Error(json.error || `Could not start the assessment (HTTP ${res.status}).`);
      if (!json.sessionId) throw new Error('Assessment session could not be created.');

      router.push(`/assessment/${json.sessionId}`);
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        setError('That took too long. Please check your connection and try again.');
      } else if (err instanceof TypeError) {
        setError('Network connection interrupted. Please try again.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0B1220] text-[#F3F5FA] px-4 py-12 sm:py-16">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-8">
          <p className="text-[11px] text-[#5B6580] tracking-[0.1em] uppercase font-semibold">
            {platformName}
          </p>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white mt-3 leading-snug">
            {companyName} invites you to take an assessment
            {roleName ? (
              <>
                {' '}for the <span className="text-[#5B8CFF]">{roleName}</span> position
              </>
            ) : null}
          </h1>
          <p className="text-[14px] text-[#97A2BE] mt-3">
            Hello {candidateName}. {packageName ? `${packageName}. ` : ''}
            You will work through a series of timed scenarios — there are no right answers, only
            choices.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-300">
            {error}
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-200">
            {notice}
          </div>
        )}

        {resuming && (
          <div className="mb-4 rounded-lg border border-[#5B8CFF]/30 bg-[#5B8CFF]/10 px-3.5 py-2.5 text-[13px] text-[#9DB9FF]">
            You have already started this assessment. Continuing will take you back to where you
            left off.
          </div>
        )}

        {!resuming && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sm:p-7 backdrop-blur-md shadow-xl">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#5B8CFF] border-b border-white/10 pb-3 mb-4">
              Resume / CV
              <span className="ml-2 text-[10px] text-[#97A2BE] normal-case tracking-normal font-medium">
                optional
              </span>
            </h2>

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
              className={`border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all ${
                dragging ? 'border-[#5B8CFF] bg-[#5B8CFF]/5' : 'border-white/15 hover:border-white/25'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="text-left min-w-0">
                    <p className="text-[13px] font-medium text-white truncate">{file.name}</p>
                    <p className="text-[12px] text-[#97A2BE]">
                      {(file.size / 1024).toFixed(0)} KB · ready
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="text-[#5B6580] hover:text-[#FF6B6B] transition-colors p-1"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-[13px] font-medium text-white">Drag your resume here</p>
                  <p className="text-[11.5px] text-[#5B6580] mt-1">
                    or click to browse — PDF or DOCX, max 4MB
                  </p>
                </>
              )}
            </div>

            <p className="text-[11px] text-[#5B6580] mt-3">
              Your resume is read alongside the role requirements {companyName} provided, to give
              context to your results.
            </p>
          </div>
        )}

        <button
          onClick={begin}
          disabled={loading}
          className="w-full mt-6 bg-[#2E63F6] text-white text-[15px] font-semibold px-4 py-3.5 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_4px_14px_rgba(46,99,246,0.4)] hover:bg-[#5B8CFF] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading
            ? stage || 'Preparing…'
            : resuming
              ? 'Continue assessment'
              : 'Begin assessment'}
        </button>
      </div>
    </main>
  );
}
