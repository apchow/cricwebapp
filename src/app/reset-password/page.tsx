import ResetPasswordForm from "./reset-password-form";

export const metadata = {
  title: "Choose a new password — Pundit Arena",
  description: "Set a new password for your Pundit Arena account.",
};
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute -top-40 left-1/3 w-[520px] h-[520px] bg-indigo-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[420px] h-[420px] bg-emerald-600/10 rounded-full blur-[120px]" />
      </div>
      <div className="max-w-md mx-auto px-4 sm:px-6 py-20">
        <ResetPasswordForm token={token ?? ""} />
      </div>
    </div>
  );
}