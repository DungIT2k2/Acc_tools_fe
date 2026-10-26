import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";
import ConnectionStatus from "../components/ConnectionStatus";

export const metadata: Metadata = {
  title: "Tools Kế Toán",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ConnectionStatus>
          <AuthGuard>{children}</AuthGuard>
        </ConnectionStatus>
      </body>
    </html>
  );
}
