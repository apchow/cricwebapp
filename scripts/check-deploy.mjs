#!/usr/bin/env node
/* Did my push go live?

   The Vercel Git integration posts its deployment result onto the commit as a
   GitHub status, so the answer is public and needs no Vercel login, no CLI and
   no token for a public repo. Run it right after `git push`:

     node scripts/check-deploy.mjs            # checks local main
     node scripts/check-deploy.mjs <sha>      # or any commit

   Exits 0 on "Deployment has completed", non-zero on a block or a failed
   build, and prints the dashboard URL Vercel linked for the detail. */

import { execFileSync } from "node:child_process";

const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const remote = git(["remote", "get-url", "origin"]);
const repo = /[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(remote)?.[1];
if (!repo) {
  console.error(`could not read owner/repo from origin: ${remote}`);
  process.exit(2);
}

const sha = process.argv[2] ?? git(["rev-parse", "main"]);
const headers = {
  accept: "application/vnd.github+json",
  ...(process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
};

const deadline = Date.now() + 5 * 60_000;
const outcome = { success: "live", failure: "blocked or failed", error: "blocked or failed" };
let printed = null;

console.log(`watching ${repo} @ ${sha.slice(0, 7)}`);

for (;;) {
  const response = await fetch(
    `https://api.github.com/repos/${repo}/commits/${sha}/status`,
    { headers }
  );
  if (!response.ok) {
    console.error(`GitHub answered ${response.status}; is the repo private? Set GITHUB_TOKEN.`);
    process.exit(2);
  }
  const status = await response.json();
  const vercel = (status.statuses ?? []).filter((s) => /vercel/i.test(s.context));
  const worst = vercel.some((s) => s.state === "failure")
    ? "failure"
    : vercel.some((s) => s.state === "pending")
      ? "pending"
      : status.state;

  for (const s of vercel) {
    const line = `${s.state.padEnd(8)} ${s.description ?? ""}`.trimEnd();
    if (line !== printed) console.log(line);
    printed = line;
  }

  if (worst !== "pending") {
    const link = vercel.find((s) => s.target_url)?.target_url;
    console.log(`→ ${worst}: ${outcome[worst] ?? worst}`);
    console.log(`→ https://punditarena.vercel.app  ${link ? `\n   detail: ${link}` : ""}`);
    process.exit(worst === "success" ? 0 : 1);
  }
  if (Date.now() > deadline) {
    console.log("→ still building after 5 minutes; check the dashboard.");
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 10_000));
}
