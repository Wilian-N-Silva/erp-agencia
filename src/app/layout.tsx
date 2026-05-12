import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Sistema Interno FG",
  description: "Sistema interno de gestao operacional, financeira e administrativa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
