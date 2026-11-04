import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/app-url";

const BASE_URL = appUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/login"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
