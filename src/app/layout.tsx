import ConnectionStatus from "../components/ConnectionStatus";

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
