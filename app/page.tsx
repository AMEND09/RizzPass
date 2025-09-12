import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Shield, Key, Zap, CheckCircle } from 'lucide-react';

export default function HomePage() {
  const features = [
    {
      icon: <Shield className="w-6 h-6 text-blue-600" />,
      title: 'Military-Grade Encryption',
      description: 'Your passwords are encrypted with AES-256 encryption, the same standard used by banks and governments.'
    },
    {
      icon: <Key className="w-6 h-6 text-green-600" />,
      title: 'Password Generator',
      description: 'Generate strong, unique passwords for every account with our built-in password generator.'
    },
    {
      icon: <Zap className="w-6 h-6 text-purple-600" />,
      title: 'Quick Access',
      description: 'Find and copy your passwords instantly with powerful search and categorization features.'
    },
    {
      icon: <CheckCircle className="w-6 h-6 text-orange-600" />,
      title: 'Secure by Default',
      description: 'Zero-knowledge architecture means we never see your passwords - only you have access.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Section */}
        <div className="pt-20 pb-16 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-full mb-8">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            RizzPass
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
            Your personal password manager built with security and simplicity in mind. 
            Store, generate, and manage all your passwords in one encrypted vault.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-8 py-3">
                Get Started Free
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="px-8 py-3">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="py-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Why Choose RizzPass?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-center mb-4">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Security Section */}
        <div className="py-16 text-center">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              Your Security is Our Priority
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              RizzPass uses industry-standard security practices to keep your data safe. 
              Your master password is never stored on our servers, and all encryption happens locally on your device.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6">
                <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">End-to-End Encryption</h3>
                <p className="text-gray-600 dark:text-gray-400">All data is encrypted before it leaves your device</p>
              </div>
              <div className="p-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Zero Knowledge</h3>
                <p className="text-gray-600 dark:text-gray-400">We can't see your passwords even if we wanted to</p>
              </div>
              <div className="p-6">
                <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Key className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Local Processing</h3>
                <p className="text-gray-600 dark:text-gray-400">Encryption and decryption happen on your device</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-16 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-12 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Ready to Secure Your Digital Life?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              Join thousands of users who trust RizzPass to keep their passwords safe and organized.
            </p>
            <Link href="/register">
              <Button size="lg" className="px-12 py-4">
                Start Using RizzPass Today
              </Button>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <footer className="py-8 text-center text-gray-600 dark:text-gray-400">
          <p>&copy; 2024 RizzPass. Built with security and privacy in mind.</p>
        </footer>
      </div>
    </div>
  );
}