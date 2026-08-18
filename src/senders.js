/**
 * Outbound delivery providers — email via Resend, SMS via Twilio, both
 * plain HTTPS (no SDK dependency). Sequences queue events regardless;
 * these decide whether delivery is automatic or lands in the Outbox for
 * a one-tap manual send.
 *
 * Env:
 *   RESEND_API_KEY + MAIL_FROM        → automatic email
 *   TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM → automatic SMS
 */

const env = (k) => {
  let v = process.env[k];
  if (typeof v === 'string') {
    v = v.trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1).trim();
  }
  return v || null;
};

export const emailConfigured = () => !!(env('RESEND_API_KEY') && env('MAIL_FROM'));
export const smsConfigured = () => !!(env('TWILIO_ACCOUNT_SID') && env('TWILIO_AUTH_TOKEN') && env('TWILIO_FROM'));

/** Plain-text email through Resend. Throws with the vendor's error body. */
export async function sendEmail({ to, subject, body }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env('MAIL_FROM'), to: [to], subject, text: body }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { via: 'resend', id: (await res.json()).id };
}

/** SMS through Twilio's Messages API. */
export async function sendSms({ to, body }) {
  const sid = env('TWILIO_ACCOUNT_SID');
  const digits = '+1' + String(to).replace(/\D/g, '').replace(/^1/, '');
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${env('TWILIO_AUTH_TOKEN')}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: env('TWILIO_FROM'), To: digits, Body: body }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return { via: 'twilio', id: (await res.json()).sid };
}
