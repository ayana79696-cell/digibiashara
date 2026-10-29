import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BranchPilot | Retail Control Center',
  description: 'Manage branches, sales, inventory, staff and M-Pesa for Kenyan retailers.',
  manifest: '/manifest.json',
  icons: { icon: '/branchpilot-icon.svg', shortcut: '/branchpilot-icon.svg', apple: '/branchpilot-icon.svg' },
  themeColor: '#174b39',
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}