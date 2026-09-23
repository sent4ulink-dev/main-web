import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'A little signal, a little love',
  description: 'One question. Two cats. A little love story on an old screen.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
