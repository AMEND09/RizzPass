import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/database';
import { generateToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const { email, password, username } = await request.json();
    
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: 'Email, username and password are required' },
        { status: 400 }
      );
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }
    
  const user = await createUser(email, password, username);
    const token = generateToken({ userId: user.id, email: user.email });
    
    const response = NextResponse.json({
      message: 'User created successfully',
      user: { id: user.id, email: user.email, username: user.username, encryption_salt: user.encryption_salt }
    });
    
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });
  // removed debug log to avoid leaking sensitive information
    
    return response;
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return NextResponse.json(
        { error: 'Email already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}