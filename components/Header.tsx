"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Header() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Clear client-side key material and force reload to login page
      try {
        sessionStorage.removeItem('rizzpass_key');
      } catch (e) {
        // ignore if sessionStorage not available
      }
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <div className="flex items-center mr-4">
              <div className="w-9 h-9 bg-gray-900 rounded flex items-center justify-center border border-gray-700 mr-3">
                <span className="font-mono text-sm">RP</span>
              </div>
              <Link href="/" className="text-lg font-mono font-semibold text-gray-100">RizzPass</Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handleLogout}
              className="text-sm bg-gray-700 hover:bg-gray-600 text-gray-100 px-3 py-1 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
