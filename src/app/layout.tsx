import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Soft Arcade",
    template: "%s | Soft Arcade"
  },
  description: "Soft Arcade is a growing collection of small, polished browser games.",
  metadataBase: new URL("https://softarcadegames.com")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
