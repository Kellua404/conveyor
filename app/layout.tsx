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
    "A job queue Conveyor runs itself, inside one serverless function: a worker pool with a parallelism dial, retries with backoff, a dead-letter lane, and every state change streamed live. No message broker, no database, no always-on worker.",
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
