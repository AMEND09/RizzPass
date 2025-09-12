import { NextRequest, NextResponse } from 'next/server';
import { passwordQueries } from '@/lib/database';
import { verifyToken } from '@/lib/jwt';
import { decryptPassword } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const passwords = passwordQueries.findByUserId.all(payload.userId);

    const toMigrate: any[] = [];
    for (const p0 of passwords) {
      const p: any = p0;
      try {
        // Try decrypting with legacy server-side key. If successful and non-empty,
        // include for client-side re-encryption.
        const plain = decryptPassword(p.password);
        if (plain && plain.length > 0) {
          toMigrate.push({
            id: p.id,
            title: p.title,
            username: p.username,
            password_plain: plain,
            website: p.website,
            category: p.category,
            notes: p.notes
          });
        }
      } catch (e) {
        // ignore entries that can't be decrypted with legacy key
      }
    }

    return NextResponse.json({ items: toMigrate });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
