import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          This link is missing its reset token — check that you copied the whole link from
          the email, or{" "}
          <Link href="/forgot-password" className="underline">
            request a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      <ResetPasswordForm token={token} />
    </div>
  );
}
