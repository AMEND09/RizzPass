// Traditional authentication: middleware can be added here if needed for JWT/session validation
import { NextResponse } from 'next/server';

export function middleware(request: Request) {
	// Placeholder middleware: allow all requests. Replace with JWT/session validation as needed.
	return NextResponse.next();
}