import type { Metadata } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'RUTABOL-SCZ | Transporte público de Santa Cruz',
  description: 'Control de micros, tarifas, pasajeros, trasbordos y pagos del transporte público cruceño.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
