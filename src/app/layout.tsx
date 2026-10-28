import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'DigiBiashara | Your Business. Under Control.', description: 'Business management for Kenyan businesses.', manifest: '/manifest.json', icons: { icon: '/digibiashara-logo.svg', shortcut: '/digibiashara-logo.svg', apple: '/digibiashara-logo.svg' } };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
