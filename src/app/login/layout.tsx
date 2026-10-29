import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DigiBiashara Platform Administrator | BranchPilot',
  description: 'Platform administrator sign-in for DigiBiashara business setup and categories.',
};

export default function PlatformLoginLayout({children}:{children:React.ReactNode}) {
  return children;
}
