import type { Metadata } from "next";
import { Roboto, Philosopher, Roboto_Serif } from 'next/font/google';
import "./globals.css";

const roboto = Roboto({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto' });
const philosopher = Philosopher({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-philosopher' });
const robotoSerif = Roboto_Serif({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-roboto-serif' });

export const metadata: Metadata = {
  title: "Citra At-Taqwa",
  description: "Catatan Integritas dan Transparansi Kinerja - Universitas At-Taqwa Bondowoso",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${roboto.variable} ${philosopher.variable} ${robotoSerif.variable} h-full print:h-auto antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full print:min-h-0 print:h-auto print:bg-white flex flex-col font-sans">{children}</body>
    </html>
  );
}
