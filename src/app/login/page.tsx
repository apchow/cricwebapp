import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import LoginForm from "./login-form";

export const metadata = {
  title: "Sign in — Pundit Arena",
  description:
    "Sign in or create a free account to keep your saved XIs, scored matches and banter.",
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string }>;
}) {
  const session = await currentSession();
  const { next: nextParam, mode: modeParam } = await searchParams;
  const next = safeNext(nextParam);
  if (session) redirect(next);

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-20">
        <LoginForm next={next} initialMode={modeParam === "register" ? "register" : "login"} />
      </div>
    </div>
  );
}
