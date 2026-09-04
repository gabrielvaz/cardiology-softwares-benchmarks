import Link from "next/link";
import type { Metadata } from "next";
import { getProducts, getScreens, getManuals, label } from "@/lib/data";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Every cardiology product in the corpus, tagged by clinical modality, delivery architecture and workflow function.",
};

/**
 * The product index, grouped by vendor.
 *
 * The counts are the honest part of this page. A product with 0 screens and 1
 * manual has not been processed yet, and saying so is more useful than hiding
 * it: the corpus is a work in progress and the reader should be able to see
 * where the gaps are.
 */
export default function ProductsPage() {
  const products = getProducts();
  const screens = getScreens();
  const manuals = getManuals();

  const screenCount = new Map<string, number>();
  for (const s of screens) {
    if (s.product_id) screenCount.set(s.product_id, (screenCount.get(s.product_id) ?? 0) + 1);
  }

  const byVendor = new Map<string, typeof products>();
  for (const p of products) {
    const list = byVendor.get(p.vendor) ?? [];
    list.push(p);
    byVendor.set(p.vendor, list);
  }
  const vendors = [...byVendor.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  const architectureTally = new Map<string, number>();
  for (const p of products) {
    for (const a of p.architectures) {
      architectureTally.set(a, (architectureTally.get(a) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6">
      <header className="pt-10 pb-8 border-b border-rule">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Products</h1>
        <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.6] text-ink-soft">
          {products.length} products from {vendors.length} manufacturers, tagged across
          three independent facets: what they do clinically, how they are delivered, and
          where they sit in the workflow. A product is one catalogue entry even when it
          is a modular suite, with the modules carried as modality tags.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-[12px] text-ink-faint">
          {[...architectureTally.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([arch, n]) => (
              <span key={arch} className="tabular">
                <span className="text-ink font-medium">{n}</span> {label(arch)}
              </span>
            ))}
        </div>
      </header>

      {vendors.map(([vendor, list]) => (
        <section key={vendor} className="py-7 border-b border-rule-soft last:border-0">
          <h2 className="text-[11.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-4">
            {vendor}
          </h2>
          <div className="grid gap-x-6 gap-y-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {list
              .sort((a, b) => (screenCount.get(b.id) ?? 0) - (screenCount.get(a.id) ?? 0))
              .map((p) => {
                const shots = screenCount.get(p.id) ?? 0;
                const docs = manuals.filter((m) => m.product_id === p.id).length;
                return (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}/`}
                    className="border border-rule rounded-[4px] p-4 hover:border-ink-faint transition-colors"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-semibold text-[14px] tracking-tight">{p.name}</h3>
                      <span className="text-[11px] text-ink-faint tabular shrink-0">
                        {shots > 0 ? `${shots} screens` : "not processed"}
                      </span>
                    </div>
                    <div className="mt-2.5 flex gap-1.5 flex-wrap">
                      {p.architectures.map((a) => (
                        <span
                          key={a}
                          className="text-[10.5px] px-2 py-0.5 rounded-full bg-ground-sunk text-ink-soft"
                        >
                          {label(a)}
                        </span>
                      ))}
                      {p.modalities.slice(0, 3).map((m) => (
                        <span
                          key={m}
                          className="text-[10.5px] px-2 py-0.5 rounded-full border border-rule-soft text-ink-faint"
                        >
                          {label(m)}
                        </span>
                      ))}
                      {p.modalities.length > 3 && (
                        <span className="text-[10.5px] px-1 py-0.5 text-ink-faint">
                          +{p.modalities.length - 3}
                        </span>
                      )}
                    </div>
                    <p className="mt-2.5 text-[11px] text-ink-faint tabular">
                      {docs} manual{docs === 1 ? "" : "s"}
                    </p>
                  </Link>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
