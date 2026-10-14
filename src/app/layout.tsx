import type { Metadata } from "next";
import "@/styles/globals.css";
export const metadata: Metadata = {
  title: "mini-habitify — Make your everyday yours",
  description:
    "Your habits, your rhythm, your style. A personal space for daily progress.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
