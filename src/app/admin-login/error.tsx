'use client';
import React from 'react';
import Link from 'next/link';

export default function AdminLoginError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-4">
      <h1 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h1>
      <p className="text-slate-700 mb-2">{error.message}</p>
      <div className="flex gap-4 mt-4">
        <button
          onClick={reset}
          className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-900 transition"
        >
          Try again
        </button>
        <Link href="/admin-login" className="px-4 py-2 bg-slate-300 text-slate-800 rounded hover:bg-slate-400 transition">
          Back to login
        </Link>
      </div>
    </div>
  );
}
