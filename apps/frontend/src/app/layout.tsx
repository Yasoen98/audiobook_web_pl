import type { Metadata } from 'next';
import './globals.css';
import { QueryClientProvider } from '../lib/query-client-provider';
import { ThemeProvider } from '../components/theme-provider';

export const metadata: Metadata = {
  title: 'Polski Lektor AI',
  description: 'Panel zarządzania głosem i biblioteką PDF'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryClientProvider>{children}</QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
