import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pundit Arena",
    short_name: "Pundit Arena",
    description:
      "Retain your six, build the perfect XI, score ball by ball and take on the Street Strike timing challenge.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0f1a",
    theme_color: "#0a0f1a",
    categories: ["sports", "games"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
