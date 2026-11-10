import { redirect } from 'next/navigation';

/**
 * Kept so existing links and bookmarks still work. The master console's entry
 * point is /admin; employers sign in at /employer.
 */
export default function AdminLoginRedirect() {
  redirect('/admin');
}
