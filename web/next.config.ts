import type { NextConfig } from "next";

const config: NextConfig = {
  // The corpus is read-only between pipeline runs, so everything prerenders.
  output: "export",
  images: {
    // Screens and PDFs are served from jsDelivr over the public repo, not from
    // the deploy, which keeps 539 MB of manuals out of the build.
    unoptimized: true,
  },
  trailingSlash: true,
};

export default config;
