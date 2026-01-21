import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ManaVault",
  description: "MTG collection tracking and Commander deck builder.",
};

const navItems = [
  { href: "/collection", label: "Collection" },
  { href: "/decks", label: "Decks" },
  { href: "/settings/mtgjson", label: "MTGJSON Import/Status" },
  { href: "/about", label: "About" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="flex min-h-screen bg-background">
          <aside className="w-64 border-r bg-sidebar">
            <div className="px-5 py-6">
              <div className="text-lg font-semibold text-foreground">
                ManaVault
              </div>
              <p className="text-xs text-muted-foreground">
                Collection + Commander Builder
              </p>
            </div>
            <nav className="space-y-1 px-3 pb-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-accent hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1">
            <div className="px-8 py-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
