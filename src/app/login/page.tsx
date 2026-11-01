import { redirect } from "next/navigation";
import { currentSession } from "@/lib/auth";
import LoginForm from "./login-form";

export const metadata = { title: "Sign in — CricHub" };
export const dynamic = "force-dynamic";

function safeNext(value?: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const session = await currentSession();
  const next = safeNext(searchParams?.next);
  if (session) redirect(next);

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-20">
        <LoginForm next={next} />
      </div>
    </div>
  );
}
