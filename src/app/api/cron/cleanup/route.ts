import prisma from '@/lib/prisma';

const RETENTION_MONTHS = parseInt(process.env.DATA_RETENTION_MONTHS || '6', 10);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - RETENTION_MONTHS);

    // 순서 중요: FK 의존성 순서대로 삭제 (자식 → 부모)
    const eventDataResult = await prisma.rawQuery(
      `DELETE FROM event_data WHERE created_at < {{cutoffDate}}`,
      { cutoffDate },
    );

    const sessionDataResult = await prisma.rawQuery(
      `DELETE FROM session_data WHERE created_at < {{cutoffDate}}`,
      { cutoffDate },
    );

    const revenueResult = await prisma.rawQuery(
      `DELETE FROM revenue WHERE created_at < {{cutoffDate}}`,
      { cutoffDate },
    );

    const websiteEventResult = await prisma.rawQuery(
      `DELETE FROM website_event WHERE created_at < {{cutoffDate}}`,
      { cutoffDate },
    );

    const sessionResult = await prisma.rawQuery(
      `DELETE FROM session WHERE created_at < {{cutoffDate}}`,
      { cutoffDate },
    );

    return Response.json({
      ok: true,
      retentionMonths: RETENTION_MONTHS,
      cutoffDate: cutoffDate.toISOString(),
      deleted: {
        eventData: eventDataResult,
        sessionData: sessionDataResult,
        revenue: revenueResult,
        websiteEvent: websiteEventResult,
        session: sessionResult,
      },
    });
  } catch (error) {
    console.error('[Cron] Cleanup error:', error);
    return Response.json(
      { error: 'Cleanup failed', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
