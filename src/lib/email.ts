// Relative, extension-qualified: `node --test` loads the pure HTML builder too,
// and it does not understand the "@/lib" alias.
import { appUrl } from "./app-url.ts";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export type SendResult = { ok: true } | { ok: false; error: string };

/** True when a key is present; the reset endpoints report a clear gap if not. */
export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Resend's shared `onboarding@resend.dev` sender only delivers to the account
 * owner's own address. To email arbitrary users a verified domain is required,
 * set as RESEND_FROM (e.g. "Pundit Arena <no-reply@yourdomain>").
 */
function fromAddress(): string {
  return process.env.RESEND_FROM || "Pundit Arena <onboarding@resend.dev>";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Server-only: the key never reaches the browser. Provider error bodies are
 * deliberately not surfaced — they can echo the key or the recipient address.
 */
export async function sendEmail(input: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email is not configured" };

  let response: Response;
  try {
    response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Email provider unreachable" };
  }

  if (!response.ok) {
    return { ok: false, error: `Email provider returned ${response.status}` };
  }
  return { ok: true };
}

/** Branded, inline-styled so it survives email clients that strip <style>. */
export function passwordResetHtml(resetUrl: string): string {
  const safe = escapeHtml(resetUrl);
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0b1120;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1120;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:32px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
            <tr>
              <td style="color:#818cf8;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;padding-bottom:16px;">
                Pundit Arena
              </td>
            </tr>
            <tr>
              <td style="color:#f8fafc;font-size:24px;font-weight:800;padding-bottom:12px;">
                Reset your password
              </td>
            </tr>
            <tr>
              <td style="color:#94a3b8;font-size:14px;line-height:1.6;padding-bottom:24px;">
                We received a request to reset the password for your Pundit Arena
                account. Choose a new one below. This link expires in one hour and
                can only be used once.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <a href="${safe}" style="display:inline-block;background:linear-gradient(90deg,#6366f1,#10b981);color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:12px;">
                  Choose a new password
                </a>
              </td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:12px;line-height:1.6;padding-bottom:24px;">
                If the button does not work, copy and paste this link into your
                browser:<br />
                <span style="color:#94a3b8;word-break:break-all;">${safe}</span>
              </td>
            </tr>
            <tr>
              <td style="color:#475569;font-size:12px;line-height:1.6;border-top:1px solid #1e293b;padding-top:16px;">
                Did not request this? You can safely ignore this email — your
                password will not change.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendPasswordReset(input: {
  to: string;
  token: string;
}): Promise<SendResult> {
  const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(input.token)}`;
  return sendEmail({
    to: input.to,
    subject: "Reset your Pundit Arena password",
    html: passwordResetHtml(resetUrl),
  });
}