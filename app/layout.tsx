import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Header from '@/components/Header';
import { Toaster } from '@/components/ui/toaster';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RizzPass - Your Personal Password Manager',
  description: 'Secure password manager with end-to-end encryption. Store, generate, and manage all your passwords safely.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-900 text-gray-100`}> 
        <Header />
        <Toaster />
        {children}
      </body>
    </html>
  );
}