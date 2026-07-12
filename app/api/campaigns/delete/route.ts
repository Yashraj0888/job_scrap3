import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function POST(req: NextRequest) {
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

  try {
    const { campaignId } = await req.json();
    if (!campaignId) {
      return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
    }

    const db = await getDB();
    // Verify campaign belongs to the user
    const campaign = await db.get('SELECT id FROM campaigns WHERE id = ? AND user_email = ?', [campaignId, userEmail]);
    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Delete contacts then campaign
    await db.run('DELETE FROM contacts WHERE campaign_id = ?', [campaignId]);
    await db.run('DELETE FROM campaigns WHERE id = ?', [campaignId]);

    console.log(`Campaign ${campaignId} and its contacts deleted.`);

    return NextResponse.json({ success: true, message: 'Campaign deleted successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
