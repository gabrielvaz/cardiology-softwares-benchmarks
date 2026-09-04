import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPatterns,
  getPattern,
  getManual,
  screensByProduct,
  assetUrl,
  label,
  type Screen,
} from "@/lib/data";

/**
 * A pattern page: short summary, then every screen of that type grouped by
 * product, ordered so the products with the most examples read first.
 *
 * The comparison is deliberately left to the reader. Writing "vendor A puts the
 * lead rail on the left, vendor B on top" would be a stronger page, but it
 * would be a model's claim about a scanned manual presented as fact about a
 * competitor's product. Grouping and provenance are claims the data can back.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return getPatterns()
    .filter((p) => (p.screen_count ?? 0) > 0)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pattern = getPattern(slug);
  if (!pattern) return {};
  return {
    title: pattern.name,
    description: pattern.description,
  };
}

function Provenance({ screen }: { screen: Screen }) {
  if (screen.source.type === "manual" && screen.source.manual_id) {
    const manual = getManual(screen.source.manual_id);
    if (!manual) return null;
    return (
      <a
        href={assetUrl(manual.path, manual.cdn) + `#page=${screen.source.page}`}
        target="_blank"
        rel="noreferrer"
        className="link text-[11px] text-ink-faint hover:text-accent"
      >
        {manual.title.length > 52 ? manual.title.slice(0, 52) + "…" : manual.title}, p.
        {screen.source.page}
      </a>
    );
  }
  return (
    <span className="text-[11px] text-ink-faint">
      web capture{screen.source.captured_at ? `, ${screen.source.captured_at}` : ""}
    </span>
  );
}

function ScreenCard({ screen }: { screen: Screen }) {
  const quoted = screen.caption_source === "manual";
  return (
    <figure className="min-w-0">
      <div className="shot">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={assetUrl(screen.image)} alt={screen.caption ?? ""} loading="lazy" />
      </div>
      <figcaption className="mt-2.5">
        {screen.caption && (
          <p
            className={
              "text-[12.5px] leading-[1.45] text-ink " + (quoted ? "quoted" : "")
            }
          >
            {screen.caption}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <Provenance screen={screen} />
          {screen.modalities.length > 0 && (
            <span className="text-[10.5px] text-ink-faint">
              · {screen.modalities.map(label).join(", ")}
            </span>
          )}
        </div>
      </figcaption>
    </figure>
  );
}

export default async function PatternPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pattern = getPattern(slug);
  if (!pattern) notFound();

  const groups = screensByProduct(slug);
  const total = groups.reduce((n, g) => n + g.screens.length, 0);
  const quotedCount = groups
    .flatMap((g) => g.screens)
    .filter((s) => s.caption_source === "manual").length;

  return (
    <div className="mx-auto max-w-[1400px] px-6">
      <header className="pt-10 pb-8 border-b border-rule">
        <div className="text-[11px] uppercase tracking-[0.1em] text-ink-faint font-semibold">
          <Link href="/" className="hover:text-ink">
            Patterns
          </Link>
          <span className="mx-2 text-rule">/</span>
          {label(pattern.function_group)}
        </div>
        <h1 className="mt-3 text-[30px] font-semibold tracking-[-0.02em]">{pattern.name}</h1>
        <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.6] text-ink-soft">
          {pattern.description}
        </p>
        <p className="mt-5 text-[12px] text-ink-faint tabular">
          {total} screen{total === 1 ? "" : "s"} across {groups.length} product
          {groups.length === 1 ? "" : "s"}
          {quotedCount > 0 && (
            <> · {quotedCount} captioned in the vendor&rsquo;s own words</>
          )}
        </p>
      </header>

      {groups.map(({ product, screens }) => (
        <section key={product?.id ?? "unattributed"} className="py-9 border-b border-rule-soft last:border-0">
          <div className="flex items-baseline justify-between gap-4 mb-5">
            <h2 className="text-[15px] font-semibold tracking-tight">
              {product ? (
                <Link href={`/products/${product.id}/`} className="link">
                  {product.name}
                </Link>
              ) : (
                "Unattributed"
              )}
              {product && (
                <span className="ml-2 font-normal text-[13px] text-ink-faint">
                  {product.vendor}
                </span>
              )}
            </h2>
            <span className="text-[11px] text-ink-faint tabular shrink-0">
              {screens.length}
            </span>
          </div>

          {product && product.architectures.length > 0 && (
            <div className="mb-5 flex gap-1.5 flex-wrap">
              {product.architectures.map((a) => (
                <span
                  key={a}
                  className="text-[10.5px] px-2 py-0.5 rounded-full border border-rule text-ink-soft"
                >
                  {label(a)}
                </span>
              ))}
            </div>
          )}

          <div className="grid gap-x-4 gap-y-7 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {screens.map((s) => (
              <ScreenCard key={s.id} screen={s} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
