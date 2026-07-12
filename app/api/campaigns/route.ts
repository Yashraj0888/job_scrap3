import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  const sessionCookie = req.cookies.get('mb_session');
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let userEmail = '';
  try {
    const user = JSON.parse(sessionCookie.value);
    userEmail = user.email;
  } catch {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const campaignId = req.nextUrl.searchParams.get('id');
  const db = await getDB();

  if (campaignId) {
    // Return specific campaign details + associated contacts
    const campaign = await db.get('SELECT * FROM campaigns WHERE id = ? AND user_email = ?', [campaignId, userEmail]);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }
    const contacts = await db.all('SELECT * FROM contacts WHERE campaign_id = ?', [campaignId]);
    return NextResponse.json({ campaign, contacts });
  }

  // Return all campaigns for the logged-in user
  const campaigns = await db.all('SELECT * FROM campaigns WHERE user_email = ? ORDER BY created_at DESC', [userEmail]);
  return NextResponse.json({ campaigns });
}
