import type { Metadata } from "next";
import { getStudies, type Study } from "@/lib/data";

export const metadata: Metadata = {
  title: "Studies",
  description:
    "Usability and human factors research on cardiology devices and software, with quantitative fields extracted from each abstract.",
};

/**
 * The quantitative study table.
 *
 * Every number here is stated in the abstract it came from. Nothing is
 * converted or inferred: a satisfaction score on a 1-5 scale is not a SUS
 * score, a study design does not imply a sample size, and an abstract naming a
 * device class does not name a product. Fields that were not reported stay
 * empty, and the empty cells are the honest part of the table.
 *
 * Studies with no measurable finding are counted but not tabulated. The corpus
 * came from a broad PubMed sweep and includes work with no bearing on
 * cardiology software at all.
 */

function susBar(score: number) {
  // 68 is the established SUS average; the marker makes each score readable
  // against it without needing a legend.
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-[6px] w-[92px] bg-ground-sunk rounded-full overflow-hidden shrink-0">
        <div
          className="absolute inset-y-0 left-0 bg-accent rounded-full"
          style={{ width: `${Math.min(100, score)}%` }}
        />
        <div
          className="absolute inset-y-0 w-[1px] bg-ink-soft"
          style={{ left: "68%" }}
          title="SUS average, 68"
        />
      </div>
      <span className="tabular text-[12px] font-medium">{score.toFixed(1)}</span>
    </div>
  );
}

function Row({ study }: { study: Study }) {
  const cite = study.doi
    ? `https://doi.org/${study.doi}`
    : study.pmid
      ? `https://pubmed.ncbi.nlm.nih.gov/${study.pmid}/`
      : null;

  return (
    <tr className="border-b border-rule-soft align-top">
      <td className="py-3 pr-4">
        {cite ? (
          <a href={cite} target="_blank" rel="noreferrer" className="link text-[13px] leading-snug">
            {study.title}
          </a>
        ) : (
          <span className="text-[13px] leading-snug">{study.title}</span>
        )}
        <div className="mt-1 text-[11px] text-ink-faint">
          {study.venue}
          {study.year ? ` · ${study.year}` : ""}
        </div>
      </td>
      <td className="py-3 pr-4 text-[11.5px] text-ink-soft whitespace-nowrap">
        {study.design}
      </td>
      <td className="py-3 pr-4 text-[12px] tabular whitespace-nowrap">{study.n ?? "—"}</td>
      <td className="py-3 pr-4">
        {study.sus_score !== null ? susBar(study.sus_score) : <span className="text-ink-faint">—</span>}
      </td>
      <td className="py-3 pr-4 text-[12px] leading-snug text-ink-soft max-w-[230px]">
        {study.metric ?? "—"}
      </td>
      <td className="py-3 text-[12px] leading-snug max-w-[340px]">{study.result ?? "—"}</td>
    </tr>
  );
}

export default function StudiesPage() {
  const all = getStudies();
  const quant = all
    .filter((s) => s.has_quantitative_data)
    .sort((a, b) => {
      // SUS first because it is the only directly comparable number, then by year.
      if ((b.sus_score ?? -1) !== (a.sus_score ?? -1)) {
        return (b.sus_score ?? -1) - (a.sus_score ?? -1);
      }
      return (b.year ?? 0) - (a.year ?? 0);
    });

  const withSus = quant.filter((s) => s.sus_score !== null);
  const notRelevant = all.filter((s) => s.topics.includes("not-relevant")).length;

  if (all.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] px-6 pt-10">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Studies</h1>
        <p className="mt-4 text-[13px] text-ink-faint">
          Study extraction has not been run yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-6">
      <header className="pt-10 pb-8 border-b border-rule">
        <h1 className="text-[30px] font-semibold tracking-[-0.02em]">Studies</h1>
        <p className="mt-4 max-w-[70ch] text-[15px] leading-[1.6] text-ink-soft">
          Usability and human factors research on cardiology devices and software, with the
          measured fields lifted out of each abstract. Every number below is stated in the
          source; nothing is converted between scales or inferred from study design, and
          fields the abstract did not report are left empty.
        </p>
        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-[12px] text-ink-faint">
          <span className="tabular">
            <span className="text-ink font-medium">{all.length}</span> studies screened
          </span>
          <span className="tabular">
            <span className="text-ink font-medium">{quant.length}</span> with a measurable finding
          </span>
          <span className="tabular">
            <span className="text-ink font-medium">{withSus.length}</span> reporting a SUS score
          </span>
          {notRelevant > 0 && (
            <span className="tabular">
              <span className="text-ink font-medium">{notRelevant}</span> off-topic, kept but not tabulated
            </span>
          )}
        </div>
      </header>

      <section className="py-8">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-rule text-left">
                {["Study", "Design", "N", "SUS", "Measured", "Result"].map((h) => (
                  <th
                    key={h}
                    className="pb-2 pr-4 text-[10.5px] uppercase tracking-[0.09em] text-ink-faint font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {quant.map((s) => (
                <Row key={s.id} study={s} />
              ))}
            </tbody>
          </table>
        </div>

        {withSus.length > 0 && withSus.length < 5 && (
          <p className="mt-8 max-w-[70ch] text-[12.5px] leading-relaxed text-ink-faint">
            Only {withSus.length} of the {all.length} studies screened report a SUS score.
            Comparing usability across cardiology products quantitatively is not currently
            possible from the published literature, which is itself the finding: the
            instrument most cited as the standard is rarely the one actually used.
          </p>
        )}
      </section>
    </div>
  );
}
