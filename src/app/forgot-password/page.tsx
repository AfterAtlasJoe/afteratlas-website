import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Enter the email you signed up with and we&apos;ll send you a link to set a new password.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-sm text-zinc-500">
        <Link href="/login" className="underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
