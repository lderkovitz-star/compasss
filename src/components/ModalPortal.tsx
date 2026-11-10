'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a modal into document.body.
 *
 * Not a nicety. `position: fixed` is positioned against the viewport only
 * while no ancestor establishes a containing block, and any ancestor with a
 * transform does - including the admin shell's `animate-fade-in`, whose
 * keyframes leave a `matrix(1,0,0,1,0,0)` behind once they finish. Inside
 * that, `inset-0` resolves to the shell's full scroll height rather than the
 * screen, so a bottom sheet lands wherever that box ends: on a phone, about
 * 200px below the fold, with only the dimmed backdrop visible.
 *
 * It is invisible on a desktop layout, where the sheet is centred in a box
 * tall enough to contain it, which is why this only shows up at phone width.
 */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // document does not exist during the server render.
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
