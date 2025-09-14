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
    const { identifier } = await request.json();
    if (!identifier) return NextResponse.json({ error: 'Identifier (email or username) required' }, { status: 400 });

    // Lookup by email, then by username
    let user = db.prepare('SELECT id FROM users WHERE email = ?').get(identifier) as { id: number } | undefined;
    if (!user) {
      user = db.prepare('SELECT id FROM users WHERE username = ?').get(identifier) as { id: number } | undefined;
    }
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const passkeys = db.prepare('SELECT credential_id, public_key, counter FROM passkeys WHERE user_id = ?').all(user.id) as { credential_id: string; public_key: string; counter: number }[];

    if (passkeys.length === 0) return NextResponse.json({ error: 'No passkeys registered' }, { status: 400 });

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map(p => ({
        id: p.credential_id,
        type: 'public-key' as const,
        // `transports` should be a mutable array of AuthenticatorTransport strings
        transports: ['internal'],
      })),
      userVerification: 'preferred',
    });

    global.authChallenges = global.authChallenges || new Map();
    global.authChallenges.set(String(user.id), { challenge: options.challenge, userId: user.id });

    console.log('Generated passkey authentication options for user id', user.id);
    return NextResponse.json(options);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { identifier, response } = await request.json();
    if (!identifier || !response) return NextResponse.json({ error: 'Identifier and response required' }, { status: 400 });

    // Find user by identifier and ensure we have their email for JWT
    let user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(identifier) as { id: number; email: string } | undefined;
    if (!user) {
      user = db.prepare('SELECT id, email FROM users WHERE username = ?').get(identifier) as { id: number; email: string } | undefined;
    }
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const challengeData = global.authChallenges?.get(String(user.id));
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

    // Update counter using normalized credential id
    db.prepare('UPDATE passkeys SET counter = ? WHERE user_id = ? AND credential_id = ?').run(verification.authenticationInfo.newCounter, challengeData.userId, lookupId);

    // Generate JWT with user's email
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    const token = jwt.sign({ userId: challengeData.userId, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    global.authChallenges?.delete(String(user.id));

    return NextResponse.json({ token, verified: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
