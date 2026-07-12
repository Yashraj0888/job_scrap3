import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const appId = process.env.ADZUNA_APP_ID || '';
  const apiKey = process.env.ADZUNA_API_KEY || '';

  if (!appId && !apiKey) {
    return NextResponse.json({
      ok: false,
      message: 'ADZUNA_APP_ID and ADZUNA_API_KEY are not set in .env',
      envAppId: '(not set)',
      envApiKey: '(not set)',
    });
  }

  if (!appId) {
    return NextResponse.json({
      ok: false,
      message: 'ADZUNA_APP_ID is not set in .env',
      envAppId: '(not set)',
      envApiKey: apiKey ? '(set - ' + apiKey.length + ' chars)' : '(not set)',
    });
  }

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      message: 'ADZUNA_API_KEY is not set in .env',
      envAppId: '(set - ' + appId.length + ' chars)',
      envApiKey: '(not set)',
    });
  }

  try {
    const params = new URLSearchParams();
    params.set('app_id', appId);
    params.set('app_key', apiKey);
    params.set('what', 'test');
    params.set('results_per_page', '1');

    const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?${params.toString()}`;

    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const body = await res.text();

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      message: res.ok
        ? 'Credentials work! Adzuna API responded successfully.'
        : `Adzuna returned status ${res.status}. Check that your App ID and API Key are correct. Body: ${body.slice(0, 200)}`,
      envAppId: appId.slice(0, 4) + '...' + appId.slice(-4),
      envApiKey: apiKey.slice(0, 4) + '...' + apiKey.slice(-4),
    });
  } catch (err: unknown) {
    return NextResponse.json({
      ok: false,
      message: `Network error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      envAppId: appId.slice(0, 4) + '...' + appId.slice(-4),
      envApiKey: apiKey.slice(0, 4) + '...' + apiKey.slice(-4),
    });
  }
}
