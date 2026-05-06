import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      data: {
        status: 'ok',
        version: '1.0.0',
        time: new Date().toISOString(),
        database: 'connected',
      },
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: {
          code: 'database_unreachable',
          message: 'La base de données est inaccessible.',
        },
      },
      { status: 503 }
    );
  }
}
