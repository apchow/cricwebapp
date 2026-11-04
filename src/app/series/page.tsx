import SeriesClient from "./series-client";

export const metadata = {
  title: "Series — Pundit Arena",
  description:
    "Group your scored matches into a tournament and track the points table and net run rate.",
};

export default function SeriesPage() {
  return <SeriesClient />;
}
