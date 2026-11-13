import type { MetadataRoute } from "next";
import { PLAYERS, PLAYER_UPDATED } from "@/data/player-db";
import { TOOLS } from "@/data/tools";
import { getIplSquads } from "@/lib/retention/squads";
import { appUrl } from "@/lib/app-url";

const BASE_URL = appUrl();

/**
 * Account-specific pages: a signed-out crawler only ever sees a sign-in prompt
 * (or is redirected to /login), so there is nothing worth indexing here.
 */
const SESSION_GATED = new Set(["/scorer", "/dashboard", "/history", "/series"]);

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const pages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...TOOLS.filter((tool) => !SESSION_GATED.has(tool.href)).map((tool) => ({
      url: `${BASE_URL}${tool.href}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    {
      url: `${BASE_URL}/retention/rules`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const squads: MetadataRoute.Sitemap = getIplSquads().teams.map((team) => ({
    url: `${BASE_URL}/retention/${team.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  const players: MetadataRoute.Sitemap = PLAYERS.map((player) => ({
    url: `${BASE_URL}/players/${player.id}`,
    lastModified: PLAYER_UPDATED,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [...pages, ...squads, ...players];
}
