'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Password } from '@/lib/database';

interface PasswordFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  password?: Password | null;
}

const categories = [
  'general',
  'work',
  'personal',
  'finance',
  'social',
  'shopping',
  'entertainment'
];

export default function PasswordForm({ isOpen, onClose, onSave, password }: PasswordFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    username: '',
    password: '',
    website: '',
    category: 'general',
    notes: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (password) {
      setFormData({
        title: password.title,
        username: password.username || '',
        password: password.password,
        website: password.website || '',
        category: password.category,
        notes: password.notes || ''
      });
    } else {
      setFormData({
        title: '',
        username: '',
        password: '',
        website: '',
        category: 'general',
        notes: ''
      });
    }
  }, [password]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password: result });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Load client key from sessionStorage
      const keyBase64 = sessionStorage.getItem('rizzpass_key');
      if (!keyBase64) {
        throw new Error('Encryption key not found in session. Please log in again.');
      }
      const { importKeyFromBase64, encrypt } = await import('@/lib/clientEncryption');
      const key = await importKeyFromBase64(keyBase64);

      // Encrypt password field
      const enc = await encrypt(formData.password, key);

      const payload = {
        ...formData,
        password: JSON.stringify(enc)
      };

      const url = password ? `/api/passwords/${password.id}` : '/api/passwords';
      const method = password ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        onSave();
        onClose();
        toast({ title: 'Saved', description: 'Password saved successfully.' });
        setErrorMessage(null);
      }
    } catch (error) {
      console.error('Error saving password:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(msg);
      toast({ title: 'Error', description: msg, variant: 'destructive' as any });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{password ? 'Edit Password' : 'Add New Password'}</DialogTitle>
            <DialogDescription>{password ? 'Edit the existing password entry.' : 'Create a new encrypted password entry.'}</DialogDescription>
          </DialogHeader>
          {errorMessage && (
            <div className="px-6 -mt-2 text-sm text-red-300 font-mono">{errorMessage}</div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4 font-mono text-gray-100">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Gmail Account"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username/Email</Label>
            <Input
              id="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="username@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password *</Label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="pr-10"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generatePassword}
                className="px-3"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              placeholder="https://example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="border-gray-600 text-gray-100">
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : password ? 'Update' : 'Save'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}