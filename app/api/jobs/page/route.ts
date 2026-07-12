import { NextRequest, NextResponse } from 'next/server';
import { fetchAdzunaPage, SearchFilters } from '@/lib/jobApis';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { query, location, adzunaAppId, adzunaApiKey, country, page, filters } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Job title or keyword is required' }, { status: 400 });
    }

    const appId = adzunaAppId?.trim() || process.env.ADZUNA_APP_ID || '';
    const appKey = adzunaApiKey?.trim() || process.env.ADZUNA_API_KEY || '';

    if (!appId || !appKey) {
      return NextResponse.json({ error: 'Adzuna credentials not configured' }, { status: 400 });
    }

    const pageNum = Math.max(1, Math.min(100, page || 1));

    const result = await fetchAdzunaPage(query, location || '', appId, appKey, country || 'us', pageNum, filters as SearchFilters);

    return NextResponse.json({
      jobs: result.jobs,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to load page';
    console.error('Job page error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
