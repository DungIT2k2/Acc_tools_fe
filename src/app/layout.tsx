import type { Metadata } from "next";
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
        <AuthGuard>
          <ConnectionStatus />
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
