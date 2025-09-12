'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Copy, Edit, Trash2, Globe } from 'lucide-react';
import { Password } from '@/lib/database';

interface PasswordCardProps {
  password: Password;
  onEdit: (password: Password) => void;
  onDelete: (id: number) => void;
}

export default function PasswordCard({ password, onEdit, onDelete }: PasswordCardProps) {
  const [showPassword, setShowPassword] = useState(false);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: string } = {
      work: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      personal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      finance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      social: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      shopping: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      entertainment: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    };
    return colors[category] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  };

  return (
    <Card className="hover:shadow-md transition-shadow bg-gray-800 border border-gray-700">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-gray-100">{password.title}</h3>
            {password.username && (
              <p className="text-sm text-gray-400 mt-1">{password.username}</p>
            )}
          </div>
          <Badge className={getCategoryColor(password.category)}>
            {password.category.charAt(0).toUpperCase() + password.category.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center space-x-2">
          <div className="flex-1 font-mono text-sm bg-gray-900 text-gray-100 p-2 rounded">
            {showPassword ? password.password : '••••••••••••'}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => copyToClipboard(password.password)}
          >
            <Copy className="w-4 h-4" />
          </Button>
        </div>

        {password.website && (
          <div className="flex items-center text-sm text-blue-600 dark:text-blue-400">
            <Globe className="w-4 h-4 mr-2" />
            <a
              href={password.website.startsWith('http') ? password.website : `https://${password.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline truncate"
            >
              {password.website}
            </a>
          </div>
        )}

        {password.notes && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {password.notes}
          </p>
        )}

        <div className="flex justify-between items-center pt-2">
          <span className="text-xs text-gray-500">
            Updated {new Date(password.updated_at).toLocaleDateString()}
          </span>
          <div className="flex space-x-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(password)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(password.id)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}