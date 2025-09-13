import { NextRequest, NextResponse } from 'next/server';
import { generateRegistrationOptions, verifyRegistrationResponse } from '@simplewebauthn/server';
import { db } from '@/lib/database';
import jwt from 'jsonwebtoken';

const rpName = 'RizzPass';
const rpID = process.env.NODE_ENV === 'production' ? 'yourdomain.com' : 'localhost';
const origin = process.env.NODE_ENV === 'production' ? 'https://yourdomain.com' : 'http://localhost:3000';

declare global {
  var challenges: Map<string, string>;
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 });

    // Check if user exists
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get existing passkeys
    const existingPasskeys = db.prepare('SELECT credential_id FROM passkeys WHERE user_id = ?').all(user.id) as { credential_id: string }[];

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(user.id.toString())),
      userName: email,
      userDisplayName: email,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map(p => ({
        id: p.credential_id,
        type: 'public-key' as const,
        transports: ['internal'] as const,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge
    global.challenges = global.challenges || new Map();
    global.challenges.set(email, options.challenge);

    console.log('Generated registration options:', JSON.stringify(options, null, 2));
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

    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: number } | undefined;
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const expectedChallenge = global.challenges?.get(email);
    if (!expectedChallenge) return NextResponse.json({ error: 'Challenge not found' }, { status: 400 });

    // Use the actual request origin header when available (helps dev on multiple ports)
    const reqOrigin = request.headers.get('origin') || origin;
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: reqOrigin,
      expectedRPID: rpID,
    });

    if (!verification.verified) return NextResponse.json({ error: 'Verification failed' }, { status: 400 });

    const { id: credentialID, publicKey: credentialPublicKey, counter } = verification.registrationInfo!.credential;

    // Normalize encodings to base64url for storage (safer for WebAuthn interchange)
    const toBase64Url = (buf: ArrayBuffer | Buffer | string) => {
      const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf as any);
      // Node supports 'base64url' in newer versions, but fall back to replace if needed
      try {
        return b.toString('base64url');
      } catch (e) {
        return b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      }
    };

    const storedCredentialId = toBase64Url(credentialID as any);
    const storedPublicKey = toBase64Url(credentialPublicKey as any);

    // Store the passkey
    db.prepare(`
      INSERT INTO passkeys (user_id, credential_id, public_key, counter, transports)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, storedCredentialId, storedPublicKey, typeof counter === 'number' ? counter : 0, JSON.stringify(response.response.transports || []));

    // Generate JWT
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    const token = jwt.sign({ userId: user.id, email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    global.challenges?.delete(email);

    return NextResponse.json({ token, verified: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
