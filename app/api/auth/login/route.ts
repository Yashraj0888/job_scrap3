import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const appURL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const redirectURI = `${appURL}/api/auth/callback`;

  if (clientID) {
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientID}&redirect_uri=${encodeURIComponent(redirectURI)}&response_type=code&scope=openid%20email%20profile&prompt=consent`;
    return NextResponse.json({ oauth: true, loginUrl: googleAuthUrl });
  }

  return NextResponse.json({ oauth: false, message: 'Google Client ID not configured. Use mock auth.' });
}
