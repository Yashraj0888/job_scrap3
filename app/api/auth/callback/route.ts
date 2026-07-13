import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/db';

export const runtime = 'nodejs';

// Handle Google OAuth callback (GET)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const appURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectURI = `${appURL}/api/auth/callback`;

  if (!code || !clientID || !clientSecret) {
    return NextResponse.redirect(`${appURL}/login?error=invalid_auth`);
  }

  try {
    // 1. Exchange auth code for token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientID,
        client_secret: clientSecret,
        redirect_uri: redirectURI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokens.access_token) throw new Error('Failed to exchange code');

    // 2. Fetch user profile
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    const email = profile.email?.toLowerCase();
    const name = profile.name || '';
    const picture = profile.picture || '';

    // 3. Restrict to Gmail users only
    if (!email || !email.endsWith('@gmail.com')) {
      return NextResponse.redirect(`${appURL}/login?error=gmail_only`);
    }

    // 4. Save to database
    const db = await getDB();
    await db.run(
      'INSERT INTO users (email, name, picture) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, picture = excluded.picture',
      [email, name, picture]
    );

    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await db.run(
      'INSERT INTO user_sessions (session_id, user_email, user_agent, ip_address) VALUES (?, ?, ?, ?)',
      [sessionId, email, userAgent, ipAddress]
    );

    // 5. Create session cookie
    const userSession = { email, name, picture, sessionId };
    const response = NextResponse.redirect(appURL);
    response.cookies.set('mb_session', JSON.stringify(userSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Google OAuth callback error:', msg);
    return NextResponse.redirect(`${appURL}/login?error=auth_failed&detail=${encodeURIComponent(msg.slice(0, 100))}`);
  }
}

// Handle Mock Sign-in (POST)
export async function POST(req: NextRequest) {
  try {
    const { email, name, picture } = await req.json();
    const cleanEmail = email?.toLowerCase().trim();

    if (!cleanEmail || !cleanEmail.endsWith('@gmail.com')) {
      return NextResponse.json({ error: 'Gmail addresses only' }, { status: 400 });
    }

    // Save mock user to DB
    const db = await getDB();
    await db.run(
      'INSERT INTO users (email, name, picture) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, picture = excluded.picture',
      [cleanEmail, name || '', picture || '']
    );

    const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const userAgent = req.headers.get('user-agent') || '';
    const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
    await db.run(
      'INSERT INTO user_sessions (session_id, user_email, user_agent, ip_address) VALUES (?, ?, ?, ?)',
      [sessionId, cleanEmail, userAgent, ipAddress]
    );

    const userSession = { email: cleanEmail, name: name || '', picture: picture || '', sessionId };
    const response = NextResponse.json({ success: true, user: userSession });
    response.cookies.set('mb_session', JSON.stringify(userSession), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 1 week
    });

    return response;
  } catch (err) {
    console.error('Mock Sign-in error:', err);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}
