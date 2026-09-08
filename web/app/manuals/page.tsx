import Link from "next/link";
import type { Metadata } from "next";
import { getManuals, getProducts, manualUrl } from "@/lib/data";

export const metadata: Metadata = {
  title: "Manuals",
  description:
    "The manual library: user manuals, service manuals, quick guides and brochures collected from manufacturer support pages.",
};

const BYTES = (n: number) =>
  n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

const LANG_NAMES: Record<string, string> = {
  en: "English",
  pt: "Portuguese",
  es: "Spanish",
  de: "German",
  it: "Italian",
  fr: "French",
  unknown: "undetermined",
};

/**
 * The manual library.
 *
 * PDFs open at their source rather than in an embedded viewer. A native viewer
 * would mean shipping pdf.js and re-solving search, zoom and printing badly,
 * when every browser already has a competent PDF reader and the files are on a
 * CDN. Deep links carry `#page=N` so a screen's provenance link lands on the
 * right page.
 */
export default function ManualsPage() {
  const manuals = getManuals();
  const products = new Map(getProducts().map((p) => [p.id, p]));

  const byVendor = new Map<string, typeof manuals>();
  for (const m of manuals) {
    const list = byVendor.get(m.vendor_slug) ?? [];
    list.push(m);
    byVendor.set(m.vendor_slug, list);
  }
  const vendors = [...byVendor.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const totalPages = manuals.reduce((n, m) => n + m.pages, 0);
  const totalBytes = manuals.reduce((n, m) => n + m.bytes, 0);
  const langs = new Map<string, number>();
  for (const m of manuals) langs.set(m.lang, (langs.get(m.lang) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-[1400px] px-6">
      <header className="pt-10 pb-8 border-b border-rule">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Manuals</h1>
        <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.6] text-ink-soft">
          {manuals.length} documents, {totalPages.toLocaleString("en")} pages, collected
          from manufacturer support pages. This is the source material every screenshot in
          CardioBench is cropped from. Files open in your browser&rsquo;s PDF reader,
          served over CDN rather than from this site.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[12px] text-ink-faint">
          <span className="tabular">
            <span className="text-ink font-medium">{(totalBytes / 1_048_576).toFixed(0)} MB</span> total
          </span>
          {[...langs.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([lang, n]) => (
              <span key={lang} className="tabular">
                <span className="text-ink font-medium">{n}</span>{" "}
                {LANG_NAMES[lang] ?? lang}
              </span>
            ))}
        </div>
      </header>

      {vendors.map(([vendor, list]) => (
        <section key={vendor} className="py-6 border-b border-rule-soft last:border-0">
          <h2 className="text-[11.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">
            {vendor.replace(/-/g, " ")}
          </h2>
          <ul className="grid gap-1.5">
            {list
              .sort((a, b) => b.pages - a.pages)
              .map((m) => {
                const product = m.product_id ? products.get(m.product_id) : undefined;
                return (
                  <li
                    key={m.id}
                    className="flex items-baseline gap-3 text-[13px] py-1.5 border-b border-rule-soft last:border-0"
                  >
                    <a
                      href={manualUrl(m)}
                      target="_blank"
                      rel="noreferrer"
                      className="link flex-1 min-w-0 truncate"
                      title={m.title}
                    >
                      {m.title}
                    </a>
                    {product && (
                      <Link
                        href={`/products/${product.id}/`}
                        className="text-[11.5px] text-ink-soft hover:text-accent shrink-0 hidden md:block"
                      >
                        {product.name}
                      </Link>
                    )}
                    <span className="text-[11px] text-ink-faint tabular shrink-0 w-[190px] text-right">
                      {m.doc_type} · {m.pages} pp · {BYTES(m.bytes)} · {m.lang}
                    </span>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
