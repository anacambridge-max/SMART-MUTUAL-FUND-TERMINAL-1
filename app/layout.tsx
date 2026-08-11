import './globals.css';

export const metadata = {
  title: 'Smart MF Decision Terminal',
  description: 'Standalone daily mutual-fund opportunity dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
