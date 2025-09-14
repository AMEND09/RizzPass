import { NextRequest, NextResponse } from 'next/server';
import { verifyUser } from '@/lib/database';
import { generateToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
  const { identifier, password } = await request.json();
  // removed server-side debug log to avoid leaking sensitive information
    
    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Identifier (email or username) and password are required' },
        { status: 400 }
      );
    }
    
    const user = await verifyUser(identifier, password);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    const token = generateToken({ userId: user.id, email: user.email });
    
    const response = NextResponse.json({
      message: 'Login successful',
      user: { id: user.id, email: user.email, encryption_salt: user.encryption_salt }
    });
    
    // ensure cookie is available for the entire site (path '/') and sent on same-origin requests
  response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });

    // DEV-only: set a non-httpOnly debug cookie so the client can confirm cookie storage
    if (process.env.NODE_ENV !== 'production') {
      response.cookies.set('debug_token', token, {
        httpOnly: false,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 // short lived for debugging
      });
  // debug logs removed for security
    }
    
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}