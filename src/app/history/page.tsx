import HistoryClient from "./history-client";

export const metadata = {
  title: "Match Centre — Pavilion XI",
  description:
    "Every match you have scored, with the full scorecard, the run worm and your career batting and bowling leaderboards.",
};

export default function HistoryPage() {
  return <HistoryClient />;
}
