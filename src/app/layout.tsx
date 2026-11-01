import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pocket Money Tracker",
  description: "Private personal finance and ledger tracker",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Pocket",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#080b11",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="[color-scheme:dark]">
      <body className="m-0 min-h-screen bg-[#080b11] bg-[radial-gradient(ellipse_at_50%_-18%,#202a40_0%,#0b0f18_40%,#080b11_78%)] font-[Inter,ui-sans-serif,system-ui,-apple-system,sans-serif] text-[15px] leading-normal text-[#f5f7fb] antialiased">
        {children}
      </body>
    </html>
  );
}
