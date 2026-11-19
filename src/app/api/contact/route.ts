import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { consumeRateLimit, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Requests for access or a demo, from the landing page and the practice
 * result. Saved for the Master Admin's Contact requests page; nothing is
 * emailed, so someone answers each one by hand.
 *
 * Open to anyone, so it is guarded three ways: five requests an hour from one
 * address, plain validation with length limits, and a hidden "website" field.
 * People never see that field, so a request that fills it came from a bot: it
 * is told the request went through, and nothing is saved.
 */

const PER_HOUR = 5;
const SOURCES = ['landing', 'practice-result'];
const MAX = { name: 120, email: 190, company: 160, message: 2000 };

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export async function POST(req: NextRequest) {
  try {
    // Counted before anything else, so a bot is limited too.
    const limit = await consumeRateLimit(`contact:${clientIp(req.headers)}`, PER_HOUR, 3600);
    if (!limit.allowed) {
      const waitMinutes = Math.max(1, Math.ceil((limit.resetAt.getTime() - Date.now()) / 60000));
      return NextResponse.json(
        {
          error: `Too many requests from this connection. Please try again in about ${waitMinutes} minute${waitMinutes === 1 ? '' : 's'}.`,
        },
        { status: 429, headers: { 'Retry-After': String(waitMinutes * 60) } }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 });
    }

    if (text(body.website)) {
      return NextResponse.json({ ok: true });
    }

    const name = text(body.name);
    const email = text(body.email).toLowerCase();
    const company = text(body.company);
    const message = text(body.message);
    const source = SOURCES.includes(body.source) ? (body.source as string) : 'landing';

    if (!name) {
      return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    }
    if (name.length > MAX.name) {
      return NextResponse.json({ error: 'That name is too long.' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX.email) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    if (company.length > MAX.company) {
      return NextResponse.json({ error: 'That company name is too long.' }, { status: 400 });
    }
    if (message.length > MAX.message) {
      return NextResponse.json(
        { error: `Please keep the message under ${MAX.message} characters.` },
        { status: 400 }
      );
    }

    await prisma.contactRequest.create({
      data: { name, email, company: company || null, message: message || null, source },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('[contact POST]', error);
    return NextResponse.json(
      { error: 'Your request could not be sent. Please try again.' },
      { status: 500 }
    );
  }
}
