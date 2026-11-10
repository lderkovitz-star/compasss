import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

/**
 * /eval/<token> — the shape the client's own documentation uses.
 *
 * It forwards to /assess?token=…, which is the real page. One note on the
 * difference, because it is deliberate rather than an oversight: their
 * examples write /eval/[id], and an id is not what belongs in this position.
 * An invitation is an unguessable, single-use, expiring credential, and the
 * segment below is that credential. If it were a candidate id, anyone who
 * could guess or enumerate an id could open somebody else's assessment, and
 * only a hashed token is stored on our side so there is nothing to leak.
 *
 * So the path shape they wanted works, and what sits in it is still a token.
 */
export default function EvalAliasPage({ params }: { params: { token: string } }) {
  const token = (params.token ?? '').trim();
  if (!token) redirect('/');
  redirect(`/assess?token=${encodeURIComponent(token)}`);
}
