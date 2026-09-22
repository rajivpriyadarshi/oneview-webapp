import type { NextConfig } from "next";

/**
 * Two builds out of one config.
 *
 * The normal one is a Next server: API routes work, the model key lives in the server's
 * environment and never reaches the browser. The other is a static export for GitHub
 * Pages, where there is no server at all — see `app/lab/apiKey.ts` for what that costs
 * and how the lab copes.
 *
 * Gated on an environment variable rather than split into two config files because the
 * two builds are the same application; the only differences are the three lines below.
 *
 * `NEXT_PUBLIC_BASE_PATH` is the repository name for a project site (`/oneview-webapp`),
 * because Pages serves a project under a path rather than at a root. Empty for a user
 * site or a custom domain. It has to be baked in at build time — every asset URL and
 * every `<Link>` carries it — which is why it is an env var on the build and not runtime
 * configuration.
 *
 * Note that the export has no `app/api`: a POST route handler cannot be statically
 * exported, and the workflow removes the directory before building rather than pretending
 * otherwise. The prototypes detect the missing route and use the browser-held key.
 */
const staticExport = process.env.NEXT_STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  ...(staticExport
    ? {
        output: "export" as const,
        basePath,
        /* Trailing slashes so that `/lab/` resolves to `lab/index.html` on a plain file
           server, which is what Pages is. Without it, `/lab` 404s. */
        trailingSlash: true,
        /* No optimiser without a server. The lab's images are already sized for their
           plates (see `public/market/README.md`), so there is nothing lost here. */
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
