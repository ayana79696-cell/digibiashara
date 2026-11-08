import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DigiBiashara | BranchPilot Business Management',
  description: 'Run your business with BranchPilot category-aware products, sales, inventory, staff and reports.',
  manifest: '/manifest.json',
  icons: { icon: '/digibiashara-app-icon.svg', shortcut: '/digibiashara-app-icon.svg', apple: '/digibiashara-app-icon.svg' },
  themeColor: '#174b39',
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}