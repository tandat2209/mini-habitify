import type { Metadata, Viewport } from "next";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import "@/styles/globals.css";
export const metadata: Metadata = {
  title: "mini-habitify — Make your everyday yours",
  description:
    "Your habits, your rhythm, your style. A personal space for daily progress.",
  applicationName: "mini-habitify",
  appleWebApp: {
    capable: true,
    title: "mini-habitify",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f5ef",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <PwaProvider>{children}</PwaProvider>
      </body>
    </html>
  );
}
