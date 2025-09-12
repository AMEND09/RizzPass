import { NextRequest, NextResponse } from 'next/server';
import { passwordQueries } from '@/lib/database';
import { verifyToken } from '@/lib/jwt';
// Passwords are encrypted client-side. Server stores ciphertext only.

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const password = passwordQueries.findById.get(parseInt(params.id), payload.userId);
    
    if (!password) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      ...(password as any),
      password: (password as any).password
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const stored = typeof password === 'string' ? password : JSON.stringify(password);

    const result = passwordQueries.update.run(
      title,
      username || null,
      stored,
      website || null,
      category || 'general',
      notes || null,
      parseInt(params.id),
      payload.userId
    );
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    const result = passwordQueries.delete.run(parseInt(params.id), payload.userId);
    
    if (result.changes === 0) {
      return NextResponse.json({ error: 'Password not found' }, { status: 404 });
    }
    
    return NextResponse.json({ message: 'Password deleted successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}