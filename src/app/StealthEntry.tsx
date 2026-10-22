'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * A quiet way into the master console.
 *
 * The console is not linked from anywhere a candidate or employer would look,
 * so whoever runs the platform needs some way in that is not an advertised
 * "Admin" button. Five clicks on the copyright line; the keyboard shortcut
 * lives in StealthHotkey, mounted in the root layout so it works site-wide.
 *
 * This is convenience, not security: the console is protected by its login -
 * a bcrypt comparison behind a rate limiter - and would be just as protected
 * if the path were printed on the homepage. Treating a hidden path as the
 * defence is how people end up with an unprotected one.
 */
const CLICKS_REQUIRED = 5;
const CLICK_WINDOW_MS = 2500;

export default function StealthEntry({ label }: { label: string }) {
  const router = useRouter();
  const [clicks, setClicks] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onClick() {
    const next = clicks + 1;
    if (next >= CLICKS_REQUIRED) {
      setClicks(0);
      router.push('/master-admin');
      return;
    }
    setClicks(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setClicks(0), CLICK_WINDOW_MS);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      // Reads as the copyright line it replaces. No pointer cursor, no hover
      // state, nothing to suggest it does anything.
      className="cursor-default select-none bg-transparent p-0 text-inherit"
      aria-label={label}
    >
      {label}
    </button>
  );
}
