import { redirect } from 'next/navigation';

/**
 * Kept so existing links and bookmarks still work. The master console's entry
 * point is /master-admin; employers sign in at /portal.
 */
export default function AdminLoginRedirect() {
  redirect('/master-admin');
}
