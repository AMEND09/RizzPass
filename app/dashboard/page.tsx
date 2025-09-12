'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Lock, LogOut } from 'lucide-react';
import { Password } from '@/lib/database';
import PasswordCard from '@/components/PasswordCard';
import PasswordForm from '@/components/PasswordForm';

export default function DashboardPage() {
  const [passwords, setPasswords] = useState<Password[]>([]);
  const [filteredPasswords, setFilteredPasswords] = useState<Password[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState<Password | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const categories = ['all', 'general', 'work', 'personal', 'finance', 'social', 'shopping', 'entertainment'];

  useEffect(() => {
    fetchPasswords();
  }, []);

  useEffect(() => {
    filterPasswords();
  }, [passwords, searchTerm, selectedCategory]);

  const fetchPasswords = async () => {
    try {
      const response = await fetch('/api/passwords');
      if (response.ok) {
        const data = await response.json();

        // Try to decrypt each password client-side using session key
        const keyBase64 = sessionStorage.getItem('rizzpass_key');
        if (keyBase64) {
          const { importKeyFromBase64, decrypt } = await import('@/lib/clientEncryption');
          const key = await importKeyFromBase64(keyBase64);

          const decrypted = await Promise.all(data.map(async (p: any) => {
            try {
              const stored = typeof p.password === 'string' ? JSON.parse(p.password) : p.password;
              if (stored && stored.ciphertext && stored.iv) {
                const plain = await decrypt(stored.ciphertext, stored.iv, key);
                return { ...p, password: plain };
              }
            } catch (e) {
              // leave as-is if decryption fails
            }
            return p;
          }));

          setPasswords(decrypted);
        } else {
          // no key in session - return ciphertext as-is
          setPasswords(data);
        }
      }
    } catch (error) {
      console.error('Error fetching passwords:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPasswords = () => {
    let filtered = passwords;

    if (searchTerm) {
      filtered = filtered.filter(password =>
        password.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (password.username && password.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (password.website && password.website.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(password => password.category === selectedCategory);
    }

    setFilteredPasswords(filtered);
  };

  const handleEdit = (password: Password) => {
    setEditingPassword(password);
    setIsFormOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this password?')) {
      try {
        const response = await fetch(`/api/passwords/${id}`, {
          method: 'DELETE'
        });
        if (response.ok) {
          fetchPasswords();
        }
      } catch (error) {
        console.error('Error deleting password:', error);
      }
    }
  };

  const handleAddNew = () => {
    setEditingPassword(null);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingPassword(null);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      try {
        sessionStorage.removeItem('rizzpass_key');
      } catch (e) {
        // ignore
      }
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Lock className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <p className="text-gray-300">Loading your secure vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-100">Your Passwords</h2>
              <p className="text-gray-400 mt-1">
                Manage your secure password collection
              </p>
            </div>
            <Button
              onClick={handleAddNew}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Password
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search passwords..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category === 'all' ? 'All Categories' : 
                     category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filteredPasswords.length === 0 ? (
          <div className="text-center py-12">
            <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-100 mb-2">
              {searchTerm || selectedCategory !== 'all' ? 'No passwords found' : 'No passwords yet'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filter criteria'
                : 'Get started by adding your first password'}
            </p>
            {!searchTerm && selectedCategory === 'all' && (
              <Button onClick={handleAddNew}>
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Password
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPasswords.map((password) => (
              <PasswordCard
                key={password.id}
                password={password}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      <PasswordForm
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSave={fetchPasswords}
        password={editingPassword}
      />
    </div>
  );
}