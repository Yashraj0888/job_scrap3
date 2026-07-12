import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const STATE_FILE_PATH = path.join(process.cwd(), 'outreach_state.json');

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get('mb_session');
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const todayStr = new Date().toLocaleDateString('en-US');
    fs.writeFileSync(STATE_FILE_PATH, JSON.stringify({ date: todayStr, count: 0 }), 'utf-8');
    console.log('🔄 Daily limit counter reset to 0 by request.');
    return NextResponse.json({ success: true, message: 'Daily limit reset successfully.' });
  } catch (err: any) {
    console.error('Error resetting daily state:', err);
    return NextResponse.json({ error: 'Failed to reset daily counter: ' + err.message }, { status: 500 });
  }
}
