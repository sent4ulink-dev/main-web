import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Бяцхан дохио, бяцхан хайр',
  description: 'Нэг асуулт. Хоёр муур. Хуучны дэлгэцэн дэх бяцхан хайрын түүх.',
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn">
      <body>{children}</body>
    </html>
  );
}
