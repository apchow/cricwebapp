import PlayersClient from "./players-client";

export const metadata = {
  title: "Stats Hub — Pavilion XI",
  description:
    "Search the full player database by franchise, role and price, then dig into batting and bowling figures from your own scored matches.",
};

export default function PlayersPage() {
  return <PlayersClient />;
}
