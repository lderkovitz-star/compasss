'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The keyboard half of the stealth entrance, mounted in the root layout so it
 * works from anywhere on the site - the footer trigger only exists on the
 * landing page, and the shortcut was asked for everywhere.
 *
 * Ctrl+Shift+C is the browser's own inspect-element binding and the browser
 * usually wins, so Ctrl+Shift+M is the primary and C is attempted in case it
 * gets through. Neither is a security boundary: the console is protected by
 * its login, not by the path being hard to guess.
 */
export default function StealthHotkey() {
  const router = useRouter();

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey) return;
      const key = event.key.toLowerCase();
      if (key === 'm' || key === 'c') {
        event.preventDefault();
        router.push('/master-admin');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router]);

  return null;
}
