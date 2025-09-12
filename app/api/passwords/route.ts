import { NextRequest, NextResponse } from 'next/server';
import { passwordQueries } from '@/lib/database';
import { verifyToken } from '@/lib/jwt';
// Passwords are now encrypted client-side (E2EE). Server stores ciphertext only.

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
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    let passwords: any[];
    if (search) {
      const searchTerm = `%${search}%`;
      passwords = passwordQueries.search.all(payload.userId, searchTerm, searchTerm, searchTerm);
    } else {
      passwords = passwordQueries.findByUserId.all(payload.userId);
    }
    
  // Return stored ciphertext to client. Client will decrypt locally.
  return NextResponse.json(passwords);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const { title, username, password, website, category, notes } = await request.json();
    
    if (!title || !password) {
      return NextResponse.json(
        { error: 'Title and password are required' },
        { status: 400 }
      );
    }
    
    // Expect client to send { ciphertext, iv } or a single ciphertext string
    const stored = typeof password === 'string' ? password : JSON.stringify(password);

    const result = passwordQueries.create.run(
      payload.userId,
      title,
      username || null,
      stored,
      website || null,
      category || 'general',
      notes || null
    );
    
    return NextResponse.json({
      id: result.lastInsertRowid,
      message: 'Password saved successfully'
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}