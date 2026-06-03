import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/components/auth/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Timecard",
  applicationName: "Timecard",
  description: "iPhoneで使いやすい勤怠タイムカード",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Timecard",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-v2.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/favicon-32-v2.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16-v2.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/timecard-icon-192-v2.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/timecard-icon-512-v2.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon-v2.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2ff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white dark:bg-slate-950">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
