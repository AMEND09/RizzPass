'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Mail, Eye, EyeOff, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { startAuthentication } from '@simplewebauthn/browser';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  // Feature flag to hide passkey button while in development
  const SHOW_PASSKEY_BUTTON = false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // include credentials so cookies set by the server are stored by the browser
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier, password }),
        credentials: 'same-origin'
      });

  const data = await response.json().catch(() => ({}));

  // Debug logs removed: avoid printing cookies/keys to console in dev

      if (response.ok) {
        // log cookies (the debug cookie is non-httpOnly in dev) so we can see whether the browser saved it
              try {
          // intentionally not reading or logging document.cookie for security
        } catch (e) {
          // ignore
        }
        // derive and store client-side encryption key using the login password and server-provided salt
              try {
          // Use the already-parsed `data` instead of calling response.json() a second time
          const salt = data?.user?.encryption_salt;
          if (salt) {
            const { deriveKey, exportKeyToBase64 } = await import('@/lib/clientEncryption');
            let exported: string | null = null;
            try {
              const key = await deriveKey(password, salt);
              exported = await exportKeyToBase64(key);
              // store key material in sessionStorage for this session only
              sessionStorage.setItem('rizzpass_key', exported);
              // store the canonical user email if returned, otherwise fallback to identifier
              sessionStorage.setItem('user_email', data?.user?.email || identifier);
            } catch (err) {
              console.error('[login] key derivation/export failed', err);
              const msg = err instanceof Error ? err.message : 'Failed to derive encryption key';
              toast({ title: 'Encryption error', description: msg, variant: 'destructive' as any });
              // surface error so caller can react
              throw new Error(msg);
            }
            // Attempt migration of legacy server-encrypted rows: fetch plaintexts and re-encrypt
            try {
              const migrateResp = await fetch('/api/auth/migrate');
              if (migrateResp.ok) {
                const { items } = await migrateResp.json();
                if (Array.isArray(items) && items.length > 0) {
                  if (!exported) throw new Error('Exported key missing for migration');
                  const { importKeyFromBase64, encrypt } = await import('@/lib/clientEncryption');
                  const ck = await importKeyFromBase64(exported);
                  for (const it of items) {
                    try {
                      const enc = await encrypt(it.password_plain, ck);
                      await fetch(`/api/passwords/${it.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          title: it.title,
                          username: it.username,
                          password: JSON.stringify(enc),
                          website: it.website,
                          category: it.category,
                          notes: it.notes
                        })
                      });
                    } catch (e) {
                      console.warn('[migration] failed for id', it.id, e);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('[migration] migration endpoint failed', e);
            }
          }
        } catch (err) {
          console.warn('[login] failed to derive/store encryption key', err);
        }

        // force a full reload so middleware sees the cookie and client has key
        window.location.href = '/dashboard';
      } else {
        setError(data?.error || 'Login failed');
      }
    } catch (err) {
      console.error('[login] unexpected error', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    const email = prompt('Enter your email for passkey login');
    if (!email) return;
    setLoading(true);
    setError('');

    try {
      const optionsResp = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!optionsResp.ok) {
        const data = await optionsResp.json();
        setError(data?.error || 'Failed to get passkey options');
        return;
      }
      const options = await optionsResp.json().catch(() => null);

      console.log('[passkey-client] server options:', options);
      if (!options) {
        setError('Passkey options malformed from server');
        return;
      }

      // Prefer passing the options directly; wrap only if the library warns.
      let authResp: any;
      try {
        authResp = await startAuthentication(options as any);
      } catch (err) {
        console.warn('[passkey-client] startAuthentication failed, retrying wrapped:', err);
        // fallback to wrapped form the browser helper also accepts
        authResp = await startAuthentication({ publicKey: options } as any);
      }
      const verificationResp = await fetch('/api/auth/passkey/login', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, response: authResp }),
      });
      if (verificationResp.ok) {
        const data = await verificationResp.json();
        // Store the canonical user email returned by server or fallback to identifier
        sessionStorage.setItem('user_email', data?.user?.email || identifier);
        window.location.href = '/dashboard';
      } else {
        const data = await verificationResp.json();
        setError(data?.error || 'Passkey verification failed');
      }
    } catch (err) {
      console.error('Passkey login error', err);
      setError('Passkey login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-between text-gray-300">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center">
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">RizzPass</h1>
              <p className="text-sm text-gray-400">Your trusted password manager</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          {/* Terminal-style header */}
          <div className="flex items-center px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-red-400 rounded-full inline-block" />
              <span className="w-3 h-3 bg-yellow-400 rounded-full inline-block" />
              <span className="w-3 h-3 bg-green-400 rounded-full inline-block" />
            </div>
            <div className="ml-4 text-gray-400 text-sm">Sign in — terminal</div>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4 font-mono text-gray-100">
              <div>
                  <Label htmlFor="identifier" className="text-sm text-gray-300">email or username</Label>
                    <div className="relative mt-1">
                      <Input
                        id="identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        className="pl-3 pr-3 h-10"
                        placeholder="you@example.com or username"
                        required
                      />
                    </div>
              </div>

              <div>
                <Label htmlFor="password" className="text-sm text-gray-300">password</Label>
                <div className="relative mt-1">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-3 pr-10 h-10"
                    placeholder="hunter2"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                    aria-label="toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-900 text-red-200 px-3 py-2 rounded text-sm">{error}</div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <Button
                    type="submit"
                    className="font-mono text-sm px-4 py-2"
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Sign In'}
                  </Button>
                  {SHOW_PASSKEY_BUTTON && (
                    <Button
                      type="button"
                      onClick={handlePasskeyLogin}
                      className="font-mono text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700"
                      disabled={loading}
                    >
                      <Key className="w-4 h-4 mr-1" />
                      Passkey
                    </Button>
                  )}
                </div>

                <Link href="/register" className="text-sm text-gray-400 hover:text-gray-200">
                  Create account
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}