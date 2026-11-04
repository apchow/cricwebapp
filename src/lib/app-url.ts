/**
 * Absolute site URL, for the sitemap, robots and social cards.
 *
 * `NEXT_PUBLIC_APP_URL` wins when set. Otherwise Vercel's build-time project
 * domain is used, so a deploy works without any env entry; a local dev server
 * falls back to the port it actually runs on.
 */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview}`;

  return "http://localhost:4000";
}
