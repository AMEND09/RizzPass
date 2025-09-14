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
    const { identifier } = await request.json();
    if (!identifier) return NextResponse.json({ error: 'Identifier (email or username) required' }, { status: 400 });

    // Check if user exists (by email first, then username)
    let user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(identifier) as { id: number; email: string } | undefined;
    if (!user) {
      user = db.prepare('SELECT id, email FROM users WHERE username = ?').get(identifier) as { id: number; email: string } | undefined;
    }
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Get existing passkeys
    const existingPasskeys = db.prepare('SELECT credential_id FROM passkeys WHERE user_id = ?').all(user.id) as { credential_id: string }[];

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
  userID: new Uint8Array(Buffer.from(user.id.toString())),
  userName: user.email,
  userDisplayName: user.email,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map(p => ({
        id: p.credential_id,
        type: 'public-key' as const,
        transports: ['internal'],
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    // Store challenge
    global.challenges = global.challenges || new Map();
  // store challenge keyed by user id (safer than by email)
  global.challenges.set(String(user.id), options.challenge);

  console.log('Generated registration options for user id', user.id);
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

    // Find user by email or username
    let user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(identifier) as { id: number; email: string } | undefined;
    if (!user) {
      user = db.prepare('SELECT id, email FROM users WHERE username = ?').get(identifier) as { id: number; email: string } | undefined;
    }
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const expectedChallenge = global.challenges?.get(String(user.id));
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
    `).run(user.id, storedCredentialId, storedPublicKey, typeof counter === 'number' ? counter : 0, JSON.stringify(response.response?.transports || []));

    // Generate JWT
    if (!process.env.JWT_SECRET) return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    global.challenges?.delete(String(user.id));

    return NextResponse.json({ token, verified: true, user: { id: user.id, email: user.email } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
