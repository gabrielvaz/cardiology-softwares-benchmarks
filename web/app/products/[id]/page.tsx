import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getProducts,
  getProduct,
  getPatterns,
  screensForProduct,
  manualsForProduct,
  screenUrl,
  manualUrl,
  label,
} from "@/lib/data";

export const dynamicParams = false;

export function generateStaticParams() {
  return getProducts().map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) return {};
  return {
    title: `${product.name} — ${product.vendor}`,
    description: product.notes ?? undefined,
  };
}

const BYTES = (n: number) =>
  n > 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = getProduct(id);
  if (!product) notFound();

  const screens = screensForProduct(id);
  const manuals = manualsForProduct(id);
  const patterns = getPatterns();

  // Group this product's screens by pattern so the page reads as "what parts of
  // this product do we have", which is the question a reader brings here.
  const byPattern = patterns
    .map((pat) => ({ pattern: pat, screens: screens.filter((s) => s.pattern === pat.slug) }))
    .filter((g) => g.screens.length > 0)
    .sort((a, b) => b.screens.length - a.screens.length);

  const facets: [string, string[]][] = [
    ["Modality", product.modalities],
    ["Architecture", product.architectures],
    ["Workflow", product.functions],
  ];

  return (
    <div className="mx-auto max-w-[1400px] px-6">
      <header className="pt-10 pb-8 border-b border-rule">
        <div className="text-[11px] uppercase tracking-[0.1em] text-ink-faint font-semibold">
          <Link href="/products" className="hover:text-ink">
            Products
          </Link>
          <span className="mx-2 text-rule">/</span>
          {product.vendor}
        </div>
        <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.02em]">{product.name}</h1>

        {product.notes && (
          <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.6] text-ink-soft">
            {product.notes}
          </p>
        )}

        <dl className="mt-7 grid gap-5 sm:grid-cols-3 max-w-[860px]">
          {facets.map(([title, values]) => (
            <div key={title}>
              <dt className="text-[10.5px] uppercase tracking-[0.09em] text-ink-faint font-semibold">
                {title}
              </dt>
              <dd className="mt-1.5 flex gap-1.5 flex-wrap">
                {values.length > 0 ? (
                  values.map((v) => (
                    <span
                      key={v}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-ground-sunk text-ink-soft"
                    >
                      {label(v)}
                    </span>
                  ))
                ) : (
                  <span className="text-[11.5px] text-ink-faint">
                    no evidence in the documentation
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      {manuals.length > 0 && (
        <section className="py-8 border-b border-rule-soft">
          <h2 className="text-[11.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-4">
            Documentation
          </h2>
          <ul className="grid gap-2 max-w-[900px]">
            {manuals.map((m) => (
              <li
                key={m.id}
                className="flex items-baseline gap-3 text-[13px] border-b border-rule-soft pb-2 last:border-0"
              >
                <a
                  href={manualUrl(m)}
                  target="_blank"
                  rel="noreferrer"
                  className="link flex-1 min-w-0"
                >
                  {m.title}
                </a>
                <span className="text-[11px] text-ink-faint tabular shrink-0">
                  {m.doc_type} · {m.pages} pp · {BYTES(m.bytes)} · {m.lang}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {byPattern.length > 0 ? (
        byPattern.map(({ pattern, screens: list }) => (
          <section key={pattern.slug} className="py-8 border-b border-rule-soft last:border-0">
            <div className="flex items-baseline justify-between gap-4 mb-4">
              <h2 className="text-[14px] font-semibold tracking-tight">
                <Link href={`/patterns/${pattern.slug}/`} className="link">
                  {pattern.name}
                </Link>
              </h2>
              <span className="text-[11px] text-ink-faint tabular">{list.length}</span>
            </div>
            <div className="grid gap-x-4 gap-y-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((s) => (
                <figure key={s.id}>
                  <div className="shot">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screenUrl(s.image)} alt={s.caption ?? ""} loading="lazy" />
                  </div>
                  {s.caption && (
                    <figcaption
                      className={
                        "mt-2 text-[12.5px] leading-[1.45] " +
                        (s.caption_source === "manual" ? "quoted" : "")
                      }
                    >
                      {s.caption}
                      {s.source.page && (
                        <span className="text-[11px] text-ink-faint"> p.{s.source.page}</span>
                      )}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="py-10">
          <p className="text-[13px] text-ink-faint">
            No screens catalogued for this product yet.
            {manuals.length > 0 && " Its documentation has not been through the extraction pipeline."}
          </p>
        </section>
      )}
    </div>
  );
}
