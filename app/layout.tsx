import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Conveyor — a job pipeline you can watch",
  description:
    "A real serverless message queue (Upstash QStash) re-invokes a Vercel function for every item — with server-enforced concurrency, automatic retry/backoff, idempotent state, and a dead-letter lane. No always-on worker. $0.",
  metadataBase: new URL("https://conveyor.vercel.app"),
  openGraph: {
    title: "Conveyor — a job pipeline you can watch",
    description: "Watch a real serverless queue stay calm under load. Crank up the chaos and try to break it.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
