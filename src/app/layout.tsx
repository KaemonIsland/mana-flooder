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
  { href: "/search", label: "Search" },
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
        <div className="flex min-h-screen bg-transparent">
          <aside className="hidden w-72 flex-col border-r border-white/10 bg-[color:var(--panel)/0.8] backdrop-blur-xl lg:flex">
            <div className="px-6 py-7">
              <div className="text-lg font-semibold tracking-tight text-white">
                ManaVault
              </div>
              <p className="text-xs text-white/60">
                Arcane collection + Commander builder
              </p>
            </div>
            <nav className="space-y-1 px-4 pb-6">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-xl border border-transparent px-4 py-2 text-sm font-medium text-white/70 transition-all duration-200 ease-out hover:border-violet-400/30 hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1">
            <div className="px-6 py-6 lg:px-10 lg:py-8">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}
