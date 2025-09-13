import { NextRequest, NextResponse } from 'next/server';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { db } from '@/lib/database';
import jwt from 'jsonwebtoken';

const rpID = process.env.NODE_ENV === 'production' ? 'yourdomain.com' : 'localhost';
const origin = process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : 'http://localhost:3000';

declare global {
  var authChallenges: Map<string, { challenge: string; userId: number }>;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const passkeys = db.prepare('SELECT credential_id, public_key, counter FROM passkeys WHERE user_id = ?').all(user.id) as { credential_id: string; public_key: string; counter: number }[];

    if (passkeys.length === 0) return NextResponse.json({ error: 'No passkeys registered' }, { status: 400 });

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map(p => ({
        id: p.credential_id,
        type: 'public-key' as const,
        transports: ['internal'] as const,
      })),
      userVerification: 'preferred',
    });

    global.authChallenges = global.authChallenges || new Map();
    global.authChallenges.set(email, { challenge: options.challenge, userId: user.id });

    console.log('Generated options:', JSON.stringify(options, null, 2));
    return NextResponse.json(options);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { email, response } = await request.json();
    if (!email || !response) return NextResponse.json({ error: 'Email and response required' }, { status: 400 });

    const challengeData = global.authChallenges?.get(email);
    if (!challengeData) return NextResponse.json({ error: 'Challenge not found' }, { status: 400 });

    // Ensure credential id lookup uses base64url normalization
    const normalizeToBase64Url = (input: string | ArrayBuffer) => {
      if (typeof input === 'string') {
        // If it's already base64 or base64url, normalize to base64url
        return input.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
      const b = Buffer.from(input as any);
      try {
        return b.toString('base64url');
      } catch (e) {
        return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
    };

  const lookupId = normalizeToBase64Url(response.id as any);
  console.log('[passkey-login] incoming response.id:', response.id);
  console.log('[passkey-login] normalized lookupId:', lookupId);
  const passkey = db.prepare('SELECT public_key, counter FROM passkeys WHERE user_id = ? AND credential_id = ?').get(challengeData.userId, lookupId) as { public_key: string; counter: number } | undefined;
  console.log('[passkey-login] db lookup result:', passkey);
    if (!passkey) return NextResponse.json({ error: 'Passkey not found' }, { status: 400 });

    console.log('passkey found', passkey);

    // Convert stored base64url public key back to binary
    const fromBase64Url = (s: string) => {
      // convert base64url -> base64
      const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
      // pad
      const pad = base64.length % 4;
      const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
      return Buffer.from(padded, 'base64');
    };

    // Create credential object matching WebAuthnCredential interface
    const credential = {
      id: lookupId, // Keep as base64url string
      publicKey: new Uint8Array(fromBase64Url(passkey.public_key)), // Convert to Uint8Array
      counter: typeof passkey.counter === 'number' ? passkey.counter : 0,
    };

    console.log('credential object:', {
      idLength: credential.id.length,
      publicKeyLength: credential.publicKey.length,
      counter: credential.counter
    });

    const reqOrigin = request.headers.get('origin') || origin;
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challengeData.challenge,
      expectedOrigin: reqOrigin,
      expectedRPID: rpID,
      credential,
    });

    if (!verification.verified) return NextResponse.json({ error: 'Verification failed' }, { status: 400 });

    // Update counter
    db.prepare('UPDATE passkeys SET counter = ? WHERE user_id = ? AND credential_id = ?').run(verification.authenticationInfo.newCounter, challengeData.userId, response.id);

    // Generate JWT
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    const token = jwt.sign({ userId: challengeData.userId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    global.authChallenges?.delete(email);

    return NextResponse.json({ token, verified: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
