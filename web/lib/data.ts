/**
 * The data layer. Reads the pipeline's JSON output at build time.
 *
 * There is no database and no fetch: `data/*.json` is committed to the repo and
 * only changes when the pipeline runs, so every page prerenders from disk. The
 * upside is that each pipeline run produces a reviewable `git diff` of what the
 * classifier decided, which is the audit trail standing in for a human approval
 * gate.
 */

import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "..", "data");

export type Modality =
  | "resting-ecg" | "holter" | "abpm" | "stress-test" | "telemetry"
  | "spirometry" | "ai-analysis" | "education" | "cardiac-rehab"
  | "defibrillation" | "patient-monitoring";

export type Architecture =
  | "embedded-firmware" | "desktop-client" | "server-management"
  | "webapp" | "saas-cloud" | "mobile-app" | "wearable";

export type WorkflowFunction =
  | "acquisition" | "review-analysis" | "reporting-signing"
  | "management-worklist" | "distribution-integration" | "telemedicine"
  | "education";

export interface Product {
  id: string;
  name: string;
  vendor: string;
  vendor_slug: string;
  modalities: Modality[];
  architectures: Architecture[];
  functions: WorkflowFunction[];
  markets: string[];
  website: string | null;
  manual_ids: string[];
  manual_count: number;
  screen_count: number;
  notes: string | null;
}

export interface Pattern {
  slug: string;
  name: string;
  function_group: WorkflowFunction;
  description: string;
  screen_count?: number;
}

export interface Manual {
  id: string;
  product_id: string | null;
  vendor_slug: string;
  title: string;
  path: string;
  /** jsDelivr caps files at 20 MB; the two that exceed it route through raw. */
  cdn: "jsdelivr" | "raw";
  pages: number;
  bytes: number;
  lang: string;
  doc_type: string;
  sha256: string;
}

export interface ScreenSource {
  type: "manual" | "web";
  manual_id?: string;
  page?: number;
  bbox?: [number, number, number, number];
  url?: string | null;
  captured_at?: string;
}

export interface Screen {
  id: string;
  product_id: string | null;
  pattern: string | null;
  modalities: Modality[];
  image: string;
  caption: string | null;
  /** "manual" means the vendor wrote it; "model" means it was inferred. */
  caption_source?: "manual" | "model" | null;
  confidence: number | null;
  lang: string;
  width?: number;
  height?: number;
  source: ScreenSource;
  note?: string;
}

export interface Study {
  id: string;
  pmid: string | null;
  doi: string | null;
  title: string | null;
  year: number | null;
  venue: string | null;
  corpus_dir: string;
  source_file: string;
  design: string;
  topics: string[];
  n: number | null;
  sus_score: number | null;
  task_time: string | null;
  error_rate: string | null;
  devices: string[];
  product_ids: string[];
  metric: string | null;
  result: string | null;
  has_quantitative_data: boolean;
}

const GH_REPO = "gabrielvaz/cardiology-softwares-benchmarks";
const GH_BRANCH = "main";

/**
 * GitHub Pages serves a project repo from a subpath. Next rewrites its own
 * routes and bundles, but a hand-written `<img src="/img/x.webp">` is emitted
 * verbatim and 404s there, so site-owned assets have to be prefixed by hand.
 */
export function basePath(): string {
  return process.env.NEXT_PUBLIC_BASE_PATH ?? "";
}

/** For assets that ship with the site itself, under web/public. */
export function siteAsset(path: string): string {
  return `${basePath()}${path.startsWith("/") ? path : `/${path}`}`;
}

function read<T>(file: string, fallback: T): T {
  const p = path.join(DATA_DIR, file);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

/**
 * Two different asset routes, for two different reasons.
 *
 * Screens (6.4 MB of WebP) ship with the deploy: they are the site's primary
 * content, and routing them through a CDN would mean the site renders empty
 * until that CDN has indexed the repo. Manuals (539 MB of PDF) cannot ship with
 * the deploy, so they go through jsDelivr over the public repo, with the two
 * files above jsDelivr's 20 MB cap falling back to raw.githubusercontent.
 */
export function screenUrl(repoPath: string): string {
  return `${basePath()}/assets/${repoPath}`;
}

export function manualUrl(manual: Pick<Manual, "path" | "cdn">): string {
  if (manual.cdn === "raw") {
    return `https://raw.githubusercontent.com/${GH_REPO}/${GH_BRANCH}/${manual.path}`;
  }
  return `https://cdn.jsdelivr.net/gh/${GH_REPO}@${GH_BRANCH}/${manual.path}`;
}

/** @deprecated use screenUrl or manualUrl; kept so nothing silently breaks. */
export function assetUrl(repoPath: string, cdn: "jsdelivr" | "raw" = "jsdelivr"): string {
  return cdn === "raw"
    ? `https://raw.githubusercontent.com/${GH_REPO}/${GH_BRANCH}/${repoPath}`
    : `https://cdn.jsdelivr.net/gh/${GH_REPO}@${GH_BRANCH}/${repoPath}`;
}

let cache: {
  products?: Product[];
  patterns?: Pattern[];
  manuals?: Manual[];
  screens?: Screen[];
  studies?: Study[];
} = {};

export function getProducts(): Product[] {
  cache.products ??= read<Product[]>("products.json", []);
  return cache.products;
}

export function getManuals(): Manual[] {
  cache.manuals ??= read<Manual[]>("manuals.json", []);
  return cache.manuals;
}

export function getScreens(): Screen[] {
  if (!cache.screens) {
    // screens.json is the collected output; the seed file is the hand-imported
    // web captures, used on its own until the first collect run exists.
    const collected = read<Screen[]>("screens.json", []);
    cache.screens = collected.length ? collected : read<Screen[]>("screens.seed.json", []);
  }
  return cache.screens;
}

export function getStudies(): Study[] {
  cache.studies ??= read<Study[]>("studies.json", []);
  return cache.studies;
}

/** Patterns with their live screen counts, so empty ones can be hidden. */
export function getPatterns(): Pattern[] {
  if (!cache.patterns) {
    const patterns = read<Pattern[]>("patterns.json", []);
    const screens = getScreens();
    const counts = new Map<string, number>();
    for (const s of screens) {
      if (s.pattern) counts.set(s.pattern, (counts.get(s.pattern) ?? 0) + 1);
    }
    cache.patterns = patterns.map((p) => ({ ...p, screen_count: counts.get(p.slug) ?? 0 }));
  }
  return cache.patterns;
}

export function getPattern(slug: string): Pattern | undefined {
  return getPatterns().find((p) => p.slug === slug);
}

export function getProduct(id: string): Product | undefined {
  return getProducts().find((p) => p.id === id);
}

export function getManual(id: string): Manual | undefined {
  return getManuals().find((m) => m.id === id);
}

export function screensForPattern(slug: string): Screen[] {
  return getScreens().filter((s) => s.pattern === slug);
}

export function screensForProduct(id: string): Screen[] {
  return getScreens().filter((s) => s.product_id === id);
}

export function manualsForProduct(id: string): Manual[] {
  return getManuals().filter((m) => m.product_id === id);
}

/**
 * Screens for a pattern, grouped by product and ordered so the products with
 * the most examples read first. This is the shape the pattern page renders:
 * the comparison is left to the reader's eye, which is why grouping by product
 * rather than interleaving matters.
 */
export function screensByProduct(slug: string): { product: Product | undefined; screens: Screen[] }[] {
  const groups = new Map<string, Screen[]>();
  for (const s of screensForPattern(slug)) {
    const key = s.product_id ?? "unattributed";
    const list = groups.get(key) ?? [];
    list.push(s);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([id, screens]) => ({
      product: getProduct(id),
      screens: screens.sort((a, b) => (a.source.page ?? 0) - (b.source.page ?? 0)),
    }))
    .sort((a, b) => b.screens.length - a.screens.length);
}

/** Products that actually have something to show, for index pages. */
export function productsWithScreens(): Product[] {
  const counts = new Map<string, number>();
  for (const s of getScreens()) {
    if (s.product_id) counts.set(s.product_id, (counts.get(s.product_id) ?? 0) + 1);
  }
  return getProducts()
    .map((p) => ({ ...p, screen_count: counts.get(p.id) ?? 0 }))
    .filter((p) => p.screen_count > 0)
    .sort((a, b) => b.screen_count - a.screen_count);
}

export function studiesWithData(): Study[] {
  return getStudies()
    .filter((s) => s.has_quantitative_data)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
}

export const FACET_LABELS: Record<string, string> = {
  "resting-ecg": "Resting ECG",
  holter: "Holter",
  abpm: "ABPM",
  "stress-test": "Stress test",
  telemetry: "Telemetry",
  spirometry: "Spirometry",
  "ai-analysis": "AI analysis",
  education: "Education",
  "cardiac-rehab": "Cardiac rehab",
  defibrillation: "Defibrillation",
  "patient-monitoring": "Patient monitoring",
  "embedded-firmware": "Device firmware",
  "desktop-client": "Desktop client",
  "server-management": "Server / management",
  webapp: "Webapp",
  "saas-cloud": "SaaS",
  "mobile-app": "Mobile app",
  wearable: "Wearable",
  acquisition: "Acquisition",
  "review-analysis": "Review & analysis",
  "reporting-signing": "Reporting & signing",
  "management-worklist": "Management",
  "distribution-integration": "Integration",
  telemedicine: "Telemedicine",
};

export function label(value: string): string {
  return FACET_LABELS[value] ?? value;
}
