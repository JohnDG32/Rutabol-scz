import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Micros SCZ | Tecnología Web I',
  description: 'Catálogo de líneas y gestión de micros con Next.js y NestJS.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
