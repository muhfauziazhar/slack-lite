import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slack Lite — Self-hosted Team Chat",
  description: "Lightweight self-hosted team chat. Channels, threads, real-time messaging. Zero signup, zero BS.",
  openGraph: {
    title: "Slack Lite",
    description: "Self-hosted team chat — lightweight, real-time, zero signup",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
