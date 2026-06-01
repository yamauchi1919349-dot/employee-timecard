import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "タイムカード",
  applicationName: "タイムカード",
  description: "社員勤怠管理タイムカード",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "タイムカード",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon.ico", sizes: "16x16 32x32", type: "image/x-icon" },
      { url: "/icons/timecard-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/timecard-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
