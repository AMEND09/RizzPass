'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Mail, Eye, EyeOff, Key } from 'lucide-react';
import { startRegistration } from '@simplewebauthn/browser';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/dashboard');
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyRegister = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const optionsResp = await fetch('/api/auth/passkey/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!optionsResp.ok) {
        const data = await optionsResp.json();
        setError(data?.error || 'Failed to get registration options');
        return;
      }
  const options = await optionsResp.json();

  // Let @simplewebauthn/browser handle conversion of base64url <-> ArrayBuffer
  const regResp = await startRegistration(options);
      const verificationResp = await fetch('/api/auth/passkey/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, response: regResp }),
      });
      if (verificationResp.ok) {
        router.push('/dashboard');
      } else {
        const data = await verificationResp.json();
        setError(data?.error || 'Passkey registration failed');
      }
    } catch (err) {
      console.error('Passkey registration error', err);
      setError('Passkey registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center text-gray-300">
          <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center mr-3">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">RizzPass</h1>
            <p className="text-sm text-gray-400">Create your secure vault</p>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden border border-gray-700">
          <div className="flex items-center px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 border-b border-gray-700">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-red-400 rounded-full inline-block" />
              <span className="w-3 h-3 bg-yellow-400 rounded-full inline-block" />
              <span className="w-3 h-3 bg-green-400 rounded-full inline-block" />
            </div>
            <div className="ml-4 text-gray-400 text-sm">Create account — terminal</div>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4 font-mono text-gray-100">
              <div>
                <Label htmlFor="email" className="text-sm text-gray-300">email</Label>
                <div className="relative mt-1">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-3 pr-3 h-10"
                    placeholder="you@example.com"
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
                    placeholder="Create a strong password"
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

              <div>
                <Label htmlFor="confirmPassword" className="text-sm text-gray-300">confirm password</Label>
                <div className="relative mt-1">
                  <Input
                    id="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-3 pr-3 h-10"
                    placeholder="Confirm your password"
                    required
                  />
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
                    {loading ? 'Creating Account...' : 'Create Account'}
                  </Button>
                  <Button
                    type="button"
                    onClick={handlePasskeyRegister}
                    className="font-mono text-sm px-4 py-2 bg-green-600 hover:bg-green-700"
                    disabled={loading}
                  >
                    <Key className="w-4 h-4 mr-1" />
                    Passkey
                  </Button>
                </div>

                <Link href="/login" className="text-sm text-gray-400 hover:text-gray-200">
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}