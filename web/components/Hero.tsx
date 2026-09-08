import Link from "next/link";
import { siteAsset } from "@/lib/data";

/**
 * The hero.
 *
 * Two jobs, in this order: say what this is to someone who has never heard of
 * it, and get them into a pattern page. Everything else is subordinate.
 *
 * The image is a generated abstraction, not a real screenshot, and it carries
 * no text on purpose. Putting a real vendor screen here would make one
 * manufacturer the face of a comparative repository, and inventing UI labels
 * would put words in a vendor's mouth. An unlabelled mockup says "clinical
 * software" without claiming anything about anyone.
 */

interface Stat {
  value: string;
  caption: string;
}

export function Hero({ stats }: { stats: Stat[] }) {
  return (
    <section className="border-b border-rule">
      <div className="mx-auto max-w-[1400px] px-6">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-y-10 gap-x-14 items-center pt-14 pb-12 lg:pt-16 lg:pb-14">
          <div className="max-w-[54ch]">
            <p className="text-[11px] uppercase tracking-[0.14em] text-accent font-semibold">
              Cardiology software, screen by screen
            </p>

            <h1 className="mt-4 text-[38px] lg:text-[46px] leading-[1.05] font-semibold tracking-[-0.03em]">
              Every clinical UI pattern,
              <br className="hidden sm:block" /> across every vendor
            </h1>

            <p className="mt-6 text-[16px] leading-[1.6] text-ink-soft">
              Where does each vendor put lead selection? Is measurement a mode or a
              live tool? What does a report editor look like when signing is a
              regulated act? CardioBench answers by screen type, from screenshots
              cropped out of the manufacturers&rsquo; own manuals.
            </p>

            <p className="mt-4 text-[13.5px] leading-[1.6] text-ink-faint">
              Every screen links back to the manual, page and bounding box it came
              from. Captions set in italic are the vendor&rsquo;s own words, not ours.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link
                href="/patterns/ecg-viewer/"
                className="inline-flex items-center gap-2 bg-ink text-white text-[13.5px] font-medium px-4 py-2.5 rounded-[3px] hover:bg-accent transition-colors"
              >
                Start with the ECG viewer
                <span aria-hidden="true">→</span>
              </Link>
              <Link href="/products" className="link text-[13.5px] text-ink-soft hover:text-ink">
                Browse products
              </Link>
              <Link href="/manuals" className="link text-[13.5px] text-ink-soft hover:text-ink">
                Manual library
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="rounded-[5px] overflow-hidden border border-rule bg-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={siteAsset("/img/hero-ecg.webp")}
                srcSet={`${siteAsset("/img/hero-ecg-sm.webp")} 768w, ${siteAsset("/img/hero-ecg.webp")} 1536w`}
                sizes="(max-width: 1024px) 100vw, 640px"
                alt="Abstract mockup of an ECG software interface: twelve waveform traces on a dark grid, framed by unlabelled toolbars and panels."
                width={1536}
                height={1024}
                className="block w-full h-auto"
              />
            </div>
            <p className="mt-2.5 text-[10.5px] text-ink-faint leading-snug">
              Illustration, not a product. No vendor screen is used as decoration
              anywhere on this site.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 border-t border-rule-soft">
          {stats.map((s, i) => (
            <div
              key={s.caption}
              className={
                "py-6 lg:py-7 pr-6 " +
                (i > 0 ? "sm:pl-6 sm:border-l border-rule-soft " : "") +
                (i === 2 ? "lg:border-l " : "")
              }
            >
              <dt className="text-[26px] lg:text-[30px] font-semibold tabular tracking-[-0.02em] leading-none">
                {s.value}
              </dt>
              <dd className="mt-2 text-[11px] uppercase tracking-[0.08em] text-ink-faint">
                {s.caption}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
