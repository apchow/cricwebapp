import Link from "next/link";
import { ScrollText } from "lucide-react";

export const metadata = {
  title: "Terms of Use — Pundit Arena",
  description:
    "The rules for using Pundit Arena: a fan-made cricket game with no real money, public Banter posts, and no affiliation with the BCCI or IPL.",
};

const UPDATED = "13 November 2026";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-2xl p-5 sm:p-6 space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wider text-slate-300">
        {title}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-400">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-emerald-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-300/80">
            <ScrollText className="w-4 h-4" />
            Terms
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Terms of Use
          </h1>
          <p className="text-xs text-slate-500">Last updated {UPDATED}</p>
          <p className="text-sm leading-relaxed text-slate-400">
            By using Pundit Arena you agree to these terms. They are written to
            be read, not to trap you: be decent on the public wall, understand
            this is a game and not a betting service, and know that we are a fan
            project with no connection to official cricket bodies.
          </p>
        </header>

        <Section title="What Pundit Arena is">
          <p>
            Pundit Arena is a free, fan-made cricket playground: a retention
            planner, an XI builder, a ball-by-ball scorer, a stats hub, a timing
            mini-game, and a public Banter Wall. It is provided for entertainment
            and personal use.
          </p>
          <p>
            <strong className="text-slate-200">No real money.</strong> Any
            prices, coins, or points in the app are fictional reputation values
            for play only. There is no betting, no wagering, no odds, no cash
            prizes, and no cryptocurrency. Nothing here is financial advice or an
            invitation to gamble.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You are responsible for keeping your password safe and for activity
            under your account. Sign up with an email you control. The demo
            account is a shared, read-only login for looking around — do not rely
            on it to keep anything, and do not attempt to write to it.
          </p>
          <p>
            You can delete your saved XIs, matches, series and posts yourself, and
            you can ask us to delete your whole account (see Contact below).
          </p>
        </Section>

        <Section title="The Banter Wall and your content">
          <p>
            The Banter Wall is public. You keep ownership of what you post, but by
            posting you allow us to display it to other visitors and to store it
            so the wall works. Post only what you are comfortable making public.
          </p>
          <p>
            Do not post content that is abusive, hateful, harassing, threatening,
            sexually explicit, spam, or unlawful; do not impersonate others or
            share someone&rsquo;s private information. We may remove content or
            silence accounts that break these rules, and we may remove content at
            our discretion to keep the wall usable.
          </p>
          <p>
            You can report a post from the wall. Reports help us review content;
            they do not guarantee removal, and we are not obliged to act on every
            report.
          </p>
        </Section>

        <Section title="Accuracy and availability">
          <p>
            Squad lists, player figures, retention rules and live scores are
            provided as-is for play. Retention mechanics are provisional and not
            confirmed by any official body; squads and stats are derived from
            public scorecard data and may contain errors or be out of date. Live
            scores come from a third-party provider and may be delayed,
            incomplete, or unavailable. Do not rely on this app for official
            records, betting, or any decision where accuracy matters.
          </p>
          <p>
            We may change, suspend, or stop any part of the service at any time,
            and we do not guarantee uninterrupted access or that saved data will
            never be lost. Keep your own copy of anything you cannot afford to
            lose.
          </p>
        </Section>

        <Section title="No affiliation">
          <p>
            Pundit Arena is an independent fan project. It is{" "}
            <strong className="text-slate-200">
              not affiliated with, endorsed by, sponsored by, or connected to
            </strong>{" "}
            the Board of Control for Cricket in India (BCCI), the Indian Premier
            League (IPL), any franchise, or any player. All team names, player
            names, logos and marks belong to their respective owners and are used
            here only to identify the subjects of a fan game.
          </p>
        </Section>

        <Section title="Liability">
          <p>
            To the fullest extent permitted by law, Pundit Arena and its creator
            are not liable for any indirect, incidental, or consequential loss
            arising from your use of the app, including lost data or inaccurate
            information. The service is provided &ldquo;as is&rdquo; without
            warranties of any kind.
          </p>
        </Section>

        <Section title="Changes and contact">
          <p>
            We may update these terms from time to time; the date above shows the
            latest revision. Continuing to use the app after a change means you
            accept the updated terms.
          </p>
          <p>
            Questions or requests: open an issue at{" "}
            <a
              href="https://github.com/apchow/cricwebapp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-300 font-semibold hover:underline"
            >
              github.com/apchow/cricwebapp
            </a>
            . See also our{" "}
            <Link href="/privacy" className="text-slate-400 underline hover:text-slate-200">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 px-4 py-2 text-sm font-bold text-slate-200 transition"
          >
            Back to the hub
          </Link>
        </div>
      </div>
    </div>
  );
}