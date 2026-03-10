import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tax Advisor Agent",
  description: "Protected tax advisor workspace with ask-and-answer chat and source-backed responses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
