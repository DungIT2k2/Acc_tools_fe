import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";
import ConnectionStatus from "../components/ConnectionStatus";
import ThemeToggle from "../components/ThemeToggle";

// Set theme trước khi paint để không bị nháy màu
const themeInitScript = `try{var t=localStorage.getItem("theme");if(t==="dark"){document.documentElement.dataset.theme="dark"}}catch(e){}`;

export const metadata: Metadata = {
  title: "Tools Kế Toán",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <ConnectionStatus />
        <ThemeToggle />
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}
