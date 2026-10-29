import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DigiBiashara | Retail Management',
  description: 'Manage branches, sales, inventory, staff and M-Pesa with DigiBiashara.',
  manifest: '/manifest.json',
  icons: { icon: '/digibiashara-app-icon.svg', shortcut: '/digibiashara-app-icon.svg', apple: '/digibiashara-app-icon.svg' },
  themeColor: '#142B45',
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}