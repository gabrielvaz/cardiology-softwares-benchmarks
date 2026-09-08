import Link from "next/link";
import { Hero } from "@/components/Hero";
import {
  getPatterns,
  getProducts,
  getScreens,
  getManuals,
  screensByProduct,
  screenUrl,
  manualUrl,
  label,
  type Pattern,
} from "@/lib/data";

/**
 * The home page is the pattern catalogue, not a screen gallery: the reader
 * arrives asking "how does everyone solve the report editor", and the answer is
 * a page per screen type.
 *
 * Patterns with no screens yet are still listed, greyed and unlinked. Hiding
 * them would misrepresent the taxonomy as complete when the corpus is still
 * being processed, and an honest empty slot is more useful than a tidy lie.
 */

const GROUP_ORDER = [
  "acquisition",
  "review-analysis",
  "reporting-signing",
  "management-worklist",
  "distribution-integration",
  "education",
] as const;

const GROUP_TITLES: Record<string, string> = {
  acquisition: "Acquisition",
  "review-analysis": "Review & analysis",
  "reporting-signing": "Reporting & signing",
  "management-worklist": "Management",
  "distribution-integration": "Integration",
  education: "Onboarding & education",
};

function PatternCard({ pattern }: { pattern: Pattern }) {
  const count = pattern.screen_count ?? 0;
  const groups = count ? screensByProduct(pattern.slug) : [];
  const preview = groups.flatMap((g) => g.screens).slice(0, 3);
  const productCount = groups.length;

  const body = (
    <>
      <div className="aspect-[16/10] bg-ground-sunk border-b border-rule relative overflow-hidden">
        {preview.length > 0 ? (
          <div className="absolute inset-0 flex gap-1 p-2">
            {preview.map((s) => (
              <div key={s.id} className="flex-1 min-w-0 shot shot-fill rounded-[2px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={screenUrl(s.image)} alt="" loading="lazy" />
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[11px] text-ink-faint">
            not yet processed
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-semibold text-[14px] tracking-tight">{pattern.name}</h3>
          <span className="text-[11px] text-ink-faint tabular shrink-0">
            {count > 0 ? `${count} screen${count === 1 ? "" : "s"}` : "—"}
          </span>
        </div>
        <p className="mt-2 text-[12.5px] leading-[1.5] text-ink-soft line-clamp-3">
          {pattern.description}
        </p>
        {productCount > 0 && (
          <p className="mt-3 text-[11px] text-ink-faint">
            across {productCount} product{productCount === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </>
  );

  if (!count) {
    return (
      <div className="border border-rule-soft rounded-[4px] opacity-55 cursor-default">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/patterns/${pattern.slug}/`}
      className="border border-rule rounded-[4px] hover:border-ink-faint transition-colors block"
    >
      {body}
    </Link>
  );
}

export default function HomePage() {
  const patterns = getPatterns();
  const screens = getScreens();
  const products = getProducts();
  const manuals = getManuals();

  const withScreens = patterns.filter((p) => (p.screen_count ?? 0) > 0).length;
  // Only screens that made it through classification count as catalogued. The
  // seeded web captures carry no pattern yet, and counting them would overstate
  // what the site can actually show.
  const catalogued = screens.filter((s) => s.pattern).length;
  const productsShown = new Set(
    screens.filter((s) => s.pattern && s.product_id).map((s) => s.product_id),
  ).size;
  const byGroup = GROUP_ORDER.map((g) => ({
    group: g,
    patterns: patterns
      .filter((p) => p.function_group === g)
      .sort((a, b) => (b.screen_count ?? 0) - (a.screen_count ?? 0)),
  })).filter((g) => g.patterns.length > 0);

  return (
    <>
      <Hero
        stats={[
          { value: String(catalogued), caption: "screens catalogued" },
          { value: `${withScreens} of ${patterns.length}`, caption: "screen types covered" },
          { value: String(productsShown), caption: "products with screens" },
          { value: String(manuals.length), caption: "manuals" },
          {
            value: manuals.reduce((n, m) => n + m.pages, 0).toLocaleString("en"),
            caption: "pages of documentation",
          },
        ]}
      />

      <div className="mx-auto max-w-[1400px] px-6">
      {byGroup.map(({ group, patterns: list }) => (
        <section key={group} className="py-10 border-b border-rule-soft last:border-0">
          <h2 className="text-[11.5px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-5">
            {GROUP_TITLES[group] ?? label(group)}
          </h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => (
              <PatternCard key={p.slug} pattern={p} />
            ))}
          </div>
        </section>
      ))}
      </div>
    </>
  );
}
