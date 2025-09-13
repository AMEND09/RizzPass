"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, Key } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

export default function Header() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const email = sessionStorage.getItem('user_email');
    if (email) setUserEmail(email);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      // Clear client-side key material and force reload to login page
      try {
        sessionStorage.removeItem('rizzpass_key');
        sessionStorage.removeItem('user_email');
      } catch (e) {
        // ignore if sessionStorage not available
      }
      window.location.href = '/login';
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const handleCreatePasskey = async () => {
    if (!userEmail) return alert('User email not found');

    try {
      const optionsResp = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });
      if (!optionsResp.ok) throw new Error('Failed to get registration options');

      const options = await optionsResp.json();
      const regResp = await startRegistration(options);
      const verificationResp = await fetch('/api/auth/passkey/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, response: regResp }),
      });
      if (verificationResp.ok) {
        alert('Passkey created successfully!');
        setShowSettings(false);
      } else {
        alert('Passkey creation failed');
      }
    } catch (err) {
      console.error('Passkey creation error', err);
      alert('Passkey creation failed');
    }
  };

  return (
    <>
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
              {userEmail && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold"
                >
                  {userEmail.charAt(0).toUpperCase()}
                </button>
              )}
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

      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-300">Email: {userEmail}</p>
              </div>
              <button
                onClick={handleCreatePasskey}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center justify-center"
              >
                <Key className="w-4 h-4 mr-2" />
                Create Passkey
              </button>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className="text-sm text-gray-400 hover:text-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
