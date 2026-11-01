import { redirect } from "next/navigation";
import { requireUserSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AdminPanel } from "@/components/admin/AdminPanel";

export const dynamic = "force-dynamic";

export default async function AdminModerationPage() {
  const session = await requireUserSession();
  if (!session?.user?.id) redirect("/login?next=/admin/moderation");
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (me?.role !== "ADMIN") redirect("/");

  const [rules, flagged] = await Promise.all([
    prisma.moderationRule.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.comment.findMany({
      where: { flagged: true },
      include: { user: { select: { handle: true } }, duel: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AdminPanel
      initialRules={rules.map((r) => ({ id: r.id, type: r.type, pattern: r.pattern, action: r.action, notes: r.notes }))}
      flaggedComments={flagged.map((c) => ({
        id: c.id,
        handle: c.user.handle,
        body: c.body,
        duelId: c.duel.id,
        createdAt: c.createdAt.toISOString(),
      }))}
    />
  );
}
