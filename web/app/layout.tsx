import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CardioBench",
    template: "%s — CardioBench",
  },
  description:
    "A research repository of cardiology software interfaces: vendor manuals, UI screenshots catalogued by screen type, and usability research with extracted quantitative data.",
};

const NAV = [
  { href: "/", label: "Patterns" },
  { href: "/products", label: "Products" },
  { href: "/manuals", label: "Manuals" },
  { href: "/studies", label: "Studies" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-rule">
          <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-8">
            <Link href="/" className="font-semibold tracking-tight text-[15px]">
              Cardio<span className="text-accent">Bench</span>
            </Link>
            <nav className="flex items-center gap-6 text-[13px] text-ink-soft">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-ink">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-rule mt-24">
          <div className="mx-auto max-w-[1400px] px-6 py-10 text-[12px] text-ink-faint leading-relaxed">
            <p className="max-w-[60ch]">
              Screenshots are cropped from manufacturer documentation and linked back to
              the page they came from. Captions set in italic are quoted from the
              vendor&rsquo;s own text. Manuals remain the property of their manufacturers
              and are collected here for research and comparison.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
