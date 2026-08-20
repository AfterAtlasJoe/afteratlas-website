import { escapeHtml } from "@/lib/html";

export function buildPasswordResetEmail({ resetUrl }: { resetUrl: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Reset your After Atlas password",
    html: `
      <p>Someone requested a password reset for this email address on After Atlas.</p>
      <p><a href="${escapeHtml(resetUrl)}">Click here to choose a new password</a>.</p>
      <p style="color:#71717a;font-size:12px;">
        This link expires in 1 hour. If you didn't request this, you can
        safely ignore this email — your password hasn't been changed.
      </p>
    `,
  };
}

export function buildTemporaryPasswordEmail({ temporaryPassword }: { temporaryPassword: string }): {
  subject: string;
  html: string;
} {
  return {
    subject: "Your After Atlas password has been reset",
    html: `
      <p>An administrator reset your After Atlas password. Your temporary password is:</p>
      <p style="font-size:18px;font-weight:600;font-family:monospace;">${escapeHtml(temporaryPassword)}</p>
      <p>Log in with it, then we'd recommend using the "Forgot your password?" link on the
      login page to set a new password of your own choosing.</p>
    `,
  };
}
