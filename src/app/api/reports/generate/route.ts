import { NextRequest, NextResponse } from 'next/server';
import { generateReportPDF } from '@/lib/report-generator';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  try {
    const pdfBuffer = await generateReportPDF(sessionId);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="report-${sessionId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error('[reports generate]', error);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
  }
}
