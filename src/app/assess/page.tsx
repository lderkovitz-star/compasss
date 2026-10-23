import { prisma } from '@/lib/db';
import { hashInviteToken, isWellFormedInviteToken } from '@/lib/invite-token';
import { getPublicSettings } from '@/lib/settings';
import AssessInviteClient from './AssessInviteClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="min-h-screen bg-[#0B1220] text-[#F3F5FA] flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-bold text-white">{title}</h1>
        <p className="text-[14px] text-[#97A2BE] mt-2">{body}</p>
      </div>
    </main>
  );
}

export default async function AssessPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token;
  const settings = await getPublicSettings();

  if (!isWellFormedInviteToken(token)) {
    return (
      <Notice
        title="This invitation link is not valid"
        body="Check that you copied the whole link from your invitation email, or ask the company that invited you for a new one."
      />
    );
  }

  const invite = await prisma.assessmentInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      candidateName: true,
      targetRole: true,
      clientAccountId: true,
      status: true,
      expiresAt: true,
      revokedAt: true,
      sessionId: true,
      clientAccount: { select: { name: true, status: true, deletedAt: true } },
      package: { select: { name: true } },
    },
  });

  if (!invite || invite.clientAccount.deletedAt || invite.clientAccount.status !== 'ACTIVE') {
    return (
      <Notice
        title="This invitation link is not valid"
        body="Check that you copied the whole link from your invitation email, or ask the company that invited you for a new one."
      />
    );
  }
  if (invite.revokedAt) {
    return (
      <Notice
        title="This invitation has been withdrawn"
        body="Please contact the company that invited you if you believe this is a mistake."
      />
    );
  }
  if (invite.expiresAt < new Date()) {
    return (
      <Notice
        title="This invitation has expired"
        body="Ask the company that invited you to send a new link."
      />
    );
  }

  return (
    <AssessInviteClient
      token={token}
      companyName={invite.clientAccount.name}
      candidateName={invite.candidateName}
      roleName={invite.targetRole}
      packageName={invite.package?.name ?? null}
      platformName={settings.platformName}
      resuming={Boolean(invite.sessionId)}
      uploadPrefix={`tenants/${invite.clientAccountId}/resumes`}
    />
  );
}
