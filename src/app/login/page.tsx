import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import { googleConfigured } from "@/lib/oauth";
import LoginForm from "./login-form";

export const metadata = {
  title: "Sign in — Pundit Arena",
  description:
    "Sign in with Google to keep your saved XIs, scored matches and banter — one tap, no password.",
};
export const dynamic = "force-dynamic";

/**
 * Only ever send the visitor somewhere on this site. Browsers read both `//host`
 * and `/\host` as protocol-relative, so a leading slash alone is not enough.
 */
function safeNext(value?: string): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

/** The callback only ever sends known slugs; anything else stays silent. */
const SIGN_IN_NOTICES: Record<string, string> = {
  cancelled: "Google sign-in was cancelled. Try again, or continue as Guest.",
  nocode: "Google sign-in didn't finish. Please try again.",
  state: "That sign-in attempt expired. Please try again.",
  exchange: "Google didn't accept the sign-in. Please try again.",
  profile: "We couldn't read your Google profile. Please try again.",
  unverified:
    "Google says that email isn't verified, so it can't be matched to an existing account. Verify it with Google, or sign in with a different account.",
  notready: "Google sign-in isn't configured on this deployment yet.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const session = await currentSession();
  const { next: nextParam, reason } = await searchParams;
  const next = safeNext(nextParam);
  if (session) redirect(next);

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-20">
        <LoginForm
          next={next}
          googleEnabled={googleConfigured()}
          notice={reason ? SIGN_IN_NOTICES[reason] ?? null : null}
        />
      </div>
    </div>
  );
}
