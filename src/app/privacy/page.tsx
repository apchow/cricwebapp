import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Pundit Arena",
  description:
    "What Pundit Arena stores, why, and how to remove it. Your email and name from Google sign-in, your saved cricket content, and an essential session cookie — no ads or tracking.",
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

export default function PrivacyPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[520px] h-[520px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-6">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-300/80">
            <ShieldCheck className="w-4 h-4" />
            Privacy
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="text-xs text-slate-500">Last updated {UPDATED}</p>
          <p className="text-sm leading-relaxed text-slate-400">
            Pundit Arena is a fan-made cricket playground. This page explains
            exactly what we store and why. The short version: we keep the email
            and name Google shares when you sign in, the cricket content you
            choose to save, and one essential cookie to keep you signed in. We do
            not run ads, sell data, or track you across other sites.
          </p>
        </header>

        <Section title="What we collect">
          <p>
            <strong className="text-slate-200">Account details.</strong> You sign
            in with Google, and we store the email address and name Google shares
            so we can create and recognise your account. We never see or store
            your Google password — Google handles authentication. If you created
            an account before Google sign-in existed, a password hashed with
            scrypt may still be on file; it is never kept in plain text.
          </p>
          <p>
            <strong className="text-slate-200">Content you create.</strong> If
            you are signed in, we store the XIs you save, the matches you score
            (including an in-progress match so you can resume it), the series you
            build, and the takes you post on the Banter Wall along with the likes
            they receive.
          </p>
          <p>
            <strong className="text-slate-200">On your device only.</strong>{" "}
            Favourite players, your Banter silence preference, the offline mirror
            of a match in progress, and the XI Builder board are kept in your
            browser&rsquo;s local storage. These stay on your device and are not
            sent to our servers.
          </p>
        </Section>

        <Section title="What is public">
          <p>
            The <strong className="text-slate-200">Banter Wall is public</strong>.
            Anything you post there can be read by any visitor, and is shown
            against a generated handle rather than your email. Do not post
            anything you would not want strangers to see.
          </p>
          <p>
            Your saved XIs, matches and series are{" "}
            <strong className="text-slate-200">private to your account</strong>.
            A match only becomes public if you deliberately create a share link
            for it; anyone with that link can then view that one scorecard.
          </p>
        </Section>

        <Section title="Where it is stored">
          <p>
            In production your account and saved content live in a hosted
            Postgres database (provided by Neon) accessed through our hosting
            provider, Vercel. Data is stored on their infrastructure, not on your
            machine. The guest view is a single shared, read-only login used to
            let visitors look around; nothing you do as Guest is saved.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            We use one essential cookie, <code className="text-slate-300">crichub_session</code>,
            to keep you signed in. It is HttpOnly, SameSite=Lax, marked Secure in
            production, and expires after 30 days. There are no advertising,
            analytics, or third-party tracking cookies, and no embedded trackers.
            Fonts are self-hosted, so loading the site does not call a third-party
            font service. Signing in with Google takes you to google.com to
            authenticate; Google may set its own cookies on its domain, governed
            by Google&rsquo;s privacy policy, and hands us back only your email
            and name once you approve.
          </p>
        </Section>

        <Section title="Live scores">
          <p>
            International live scores are fetched on our server from a third-party
            cricket data provider (CricAPI). This happens server-to-server: your
            email, name, or saved content is never sent to them, and they do
            not receive your IP address through this feed.
          </p>
        </Section>

        <Section title="Keeping and removing your data">
          <p>
            We keep your account and saved content until you delete them. You can
            delete individual XIs, matches, series and Banter posts yourself from
            inside the app at any time. To delete your whole account and
            everything tied to it, contact us through the channel below and we
            will remove it.
          </p>
          <p>
            Pundit Arena is a reputation-coin game: there is no real money,
            betting, odds, or cryptocurrency involved, and we do not collect any
            payment information.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions, deletion requests, or anything else: open an issue on our
            public repository at{" "}
            <a
              href="https://github.com/apchow/cricwebapp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-300 font-semibold hover:underline"
            >
              github.com/apchow/cricwebapp
            </a>
            . Please do not include your Google password or any other secret in
            any message.
          </p>
          <p className="text-xs text-slate-500">
            Pundit Arena is not affiliated with, endorsed by, or connected to the
            BCCI, the IPL, or any franchise. See our{" "}
            <Link href="/terms" className="text-slate-400 underline hover:text-slate-200">
              Terms of Use
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