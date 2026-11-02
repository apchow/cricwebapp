import PlayersClient from "./players-client";

export const metadata = {
  title: "Player Stats Hub — CricHub",
  description:
    "Search the squad database and dig into batting and bowling figures from your own scored matches.",
};

export default function PlayersPage() {
  return <PlayersClient />;
}
