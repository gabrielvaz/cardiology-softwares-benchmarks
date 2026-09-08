import type { NextConfig } from "next";

/**
 * Deployed to GitHub Pages, which serves a project repo from a subpath
 * (/cardiology-softwares-benchmarks/). basePath handles routes and Next's own
 * assets; hand-written <img src> does NOT get it automatically, which is what
 * `basePath()` in lib/data.ts is for.
 *
 * BASE_PATH is passed by the workflow rather than hardcoded, so a local build
 * still serves from the root.
 */
const base = process.env.BASE_PATH ?? "";

const config: NextConfig = {
  output: "export",
  basePath: base || undefined,
  assetPrefix: base || undefined,
  env: { NEXT_PUBLIC_BASE_PATH: base },
  images: {
    // Manuals and screens are served from the repo via CDN, not from the
    // deploy, which keeps 539 MB of PDFs out of the build.
    unoptimized: true,
  },
  trailingSlash: true,
};

export default config;
