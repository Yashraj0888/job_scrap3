import { NextRequest, NextResponse } from 'next/server';
import { searchAdzunaJobs, SearchFilters } from '@/lib/jobApis';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { query, location, adzunaAppId, adzunaApiKey, country, filters } = await req.json();

    if (!query?.trim()) {
      return NextResponse.json({ error: 'Job title or keyword is required' }, { status: 400 });
    }

    const appId = adzunaAppId?.trim() || process.env.ADZUNA_APP_ID || '';
    const appKey = adzunaApiKey?.trim() || process.env.ADZUNA_API_KEY || '';

    if (!appId || !appKey) {
      return NextResponse.json({ error: 'Adzuna App ID and API Key are required. Set them in .env or enter them in the form. Get them free at https://developer.adzuna.com' }, { status: 400 });
    }

    const result = await searchAdzunaJobs(query, location || '', appId, appKey, country || 'us', filters as SearchFilters);

    return NextResponse.json({
      jobs: result.jobs,
      total: result.total,
      totalAvailable: result.total,
      page: result.page,
      totalPages: result.totalPages,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to search jobs';
    console.error('Job search error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
