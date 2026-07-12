import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export async function GET(req: NextRequest) {
  const session = req.cookies.get('mb_session');
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  try {
    const sessionUser = JSON.parse(session.value);
    const db = await getDB();
    const user = await db.get('SELECT email, name, picture, sender_email, sender_password, gemini_api_key FROM users WHERE email = ?', [sessionUser.email]);
    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch {
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
