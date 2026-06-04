import type { Metadata } from "next";
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
        <ConnectionStatus />
        {children}
      </body>
    </html>
  );
}
