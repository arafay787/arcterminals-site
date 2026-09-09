import { Resend } from "resend";

const PROJECT_NAME = process.env.NEXT_PUBLIC_PROJECT_NAME ?? "ARC TERMINALS";

/**
 * Sends the registration verification code. Requires RESEND_API_KEY and
 * EMAIL_FROM to be set (see README for setup - you need a free Resend
 * account with your domain verified). Throws if not configured, so
 * registration fails loudly instead of silently "succeeding" without
 * actually sending anything.
 */
export async function sendVerificationCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("Email is not configured. Set RESEND_API_KEY and EMAIL_FROM.");
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from,
    to: email,
    subject: `${code} is your ${PROJECT_NAME} verification code`,
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family: monospace; background: #050705; color: #39ff6a; padding: 32px;">
        <div style="font-size: 14px; opacity: 0.6;">${PROJECT_NAME} TERMINAL</div>
        <div style="margin-top: 24px; font-size: 14px;">VERIFICATION CODE:</div>
        <div style="margin-top: 8px; font-size: 32px; font-weight: bold; letter-spacing: 4px;">${code}</div>
        <div style="margin-top: 24px; font-size: 12px; opacity: 0.5;">Expires in 10 minutes. If you didn't request this, ignore this email.</div>
      </div>
    `,
  });
}
