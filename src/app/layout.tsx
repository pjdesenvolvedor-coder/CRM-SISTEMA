import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import {
  SidebarProvider,
} from '@/components/ui/sidebar';
import { AppProvider } from '@/firebase';
import { SecurityProvider } from '@/components/security-provider';

export const metadata: Metadata = {
  title: 'ZapConnect',
  description: 'Connect to WhatsApp via webhooks',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <AppProvider>
          <SecurityProvider>
            <SidebarProvider>
                {children}
            </SidebarProvider>
          </SecurityProvider>
        </AppProvider>
        <Toaster />
      </body>
    </html>
  );
}
