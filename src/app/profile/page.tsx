import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NotificationPreferencesForm } from "@/components/profile/notification-preferences-form";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fprofile");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      receiveChecklistEmail: true,
      isAdmin: true,
      adminDigestFrequency: true,
    },
  });
  if (!user) {
    redirect("/login?callbackUrl=%2Fprofile");
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-8 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Profile</h1>
        <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
      </div>

      <div>
        <h2 className="mb-3 font-medium">Notifications</h2>
        <NotificationPreferencesForm
          receiveChecklistEmail={user.receiveChecklistEmail}
          isAdmin={user.isAdmin}
          adminDigestFrequency={user.adminDigestFrequency}
        />
      </div>
    </div>
  );
}
