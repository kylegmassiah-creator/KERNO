/**
 * Netlify Function: submission-created
 *
 * Automatically called by Netlify whenever any form on the site is
 * submitted (the function name `submission-created` is a magic
 * Netlify convention - no manual wiring needed).
 *
 * Currently handles the `committee-contact` form on /contacts. Reads
 * the visitor's chosen recipient, looks up that committee member's
 * private email address, and forwards the message there directly via
 * Resend (https://resend.com - free tier covers KERNO's volume easily).
 *
 * Setup required (one-off, in the Netlify dashboard):
 *   1. Create a Resend account at resend.com (free).
 *   2. Verify cornwallorienteering.org.uk in Resend → add the supplied SPF/DKIM DNS
 *      records at the domain registrar.
 *   3. Generate a Resend API key (full sending permission).
 *   4. Add it to Netlify project: Project configuration → Environment
 *      variables → New variable, key `RESEND_API_KEY`, value <key>.
 *   5. Trigger a deploy. Done.
 *
 * Email addresses live ONLY here on the server side, never in any
 * HTML response - visitors never see them.
 */

/* ─────────── Routing table - recipient name → email ─────────── */
// Single source of truth: src/data/committee.json - edited via the CMS
// at /admin → Site settings → Committee. This function reads the JSON
// at startup so the routing table reflects the current site.
import committeeData from '../../src/data/committee.json' with { type: 'json' };
const COMMITTEE = Object.fromEntries(
  (committeeData.members || []).map(m => [m.name, m.email])
);

// Fallback for "General enquiry" or any unmatched recipient. Uses the
// info@ alias which fans out to Andy, George, Hannah and Kay so the
// general enquiry has multiple eyes on it.
const FALLBACK = 'info@cornwallorienteering.org.uk';

// FROM address - must be on a domain verified in Resend.
//
// During pre-launch testing (before cornwallorienteering.org.uk DNS records are added
// to Resend) we send from Resend's built-in test domain. Once
// cornwallorienteering.org.uk is verified, set the env var
//   RESEND_FROM_ADDRESS = KERNO website <noreply@cornwallorienteering.org.uk>
// in Netlify and this constant overrides itself with no code change.
const FROM_ADDRESS =
  process.env.RESEND_FROM_ADDRESS || 'KERNO website <onboarding@resend.dev>';

// Pre-launch test override. While set, every form submission goes to
// this single inbox regardless of the chosen recipient - useful while
// cornwallorienteering.org.uk isn't yet a verified Resend domain (Resend's test mode
// only allows sending to addresses pre-verified on the account).
// Once cornwallorienteering.org.uk is verified and FROM_ADDRESS swaps to noreply@,
// REMOVE this env var in Netlify and real routing resumes.
const TEST_OVERRIDE_TO = process.env.RESEND_OVERRIDE_TO || null;

/* ─────────── Helpers ─────────── */

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtml({ recipient, name, email, subject, message }) {
  // Table-based layout for email-client compatibility (Outlook etc.).
  // Brand palette: navy #feb92a, gold #ffc400, plum #994890, ink #1d1d1b.
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>KERNO website contact</title>
</head>
<body style="margin:0; padding:0; background:#f4f6fa; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#1d1d1b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f6fa; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; background:#ffffff; border-radius:6px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- ── Navy brand bar ── -->
        <tr><td style="background:#feb92a; padding:20px 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="color:#ffffff; font-size:18px; font-weight:600; letter-spacing:0.2px;">
                Cornwall Orienteering Club
              </td>
              <td align="right" style="color:#ffc400; font-size:12px; text-transform:uppercase; letter-spacing:1px;">
                Website contact
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- ── Gold accent rule ── -->
        <tr><td style="height:3px; background:#ffc400; line-height:3px; font-size:0;">&nbsp;</td></tr>

        <!-- ── Body ── -->
        <tr><td style="padding:28px 28px 8px 28px;">
          <p style="margin:0 0 20px 0; font-size:15px; line-height:1.5; color:#1d1d1b;">
            A new message has been submitted via the contact form on <a href="https://cornwallorienteering.org.uk" style="color:#feb92a; text-decoration:underline;">cornwallorienteering.org.uk</a>.
          </p>

          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse; margin:0 0 24px 0;">
            <tr>
              <td style="color:#666666; font-size:13px; padding:4px 16px 4px 0; vertical-align:top;"><strong>From</strong></td>
              <td style="color:#1d1d1b; font-size:14px; padding:4px 0; vertical-align:top;">${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</td>
            </tr>
            <tr>
              <td style="color:#666666; font-size:13px; padding:4px 16px 4px 0; vertical-align:top;"><strong>For</strong></td>
              <td style="color:#1d1d1b; font-size:14px; padding:4px 0; vertical-align:top;">${escapeHtml(recipient)}</td>
            </tr>
            <tr>
              <td style="color:#666666; font-size:13px; padding:4px 16px 4px 0; vertical-align:top;"><strong>Subject</strong></td>
              <td style="color:#1d1d1b; font-size:14px; padding:4px 0; vertical-align:top;">${escapeHtml(subject)}</td>
            </tr>
          </table>

          <div style="border-left:3px solid #994890; padding:4px 0 4px 16px; margin:0 0 24px 0;">
            <div style="white-space:pre-wrap; font-size:15px; line-height:1.55; color:#1d1d1b;">${escapeHtml(message)}</div>
          </div>

          <p style="margin:0 0 8px 0; font-size:13px; line-height:1.5; color:#666666;">
            Reply to this email to respond - your reply goes directly to the sender at <strong style="color:#1d1d1b;">${escapeHtml(email)}</strong>.
          </p>
        </td></tr>

        <!-- ── Footer ── -->
        <tr><td style="background:#e4e9f0; padding:18px 28px; border-top:1px solid #d4dae3;">
          <p style="margin:0; font-size:12px; line-height:1.5; color:#5a6470;">
            Cornwall Orienteering Club - orienteering across Cornwall since 1982.<br>
            Member of <a href="https://www.britishorienteering.org.uk" style="color:#feb92a; text-decoration:underline;">British Orienteering</a> and the North West Orienteering Association.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

function buildText({ recipient, name, email, subject, message }) {
  return [
    `You've received a message via the KERNO website contact form.`,
    ``,
    `From:    ${name} <${email}>`,
    `For:     ${recipient}`,
    `Subject: ${subject}`,
    ``,
    `─────────────────────────────────────────`,
    ``,
    message,
    ``,
    `─────────────────────────────────────────`,
    `Reply to this email to respond to the sender directly.`,
  ].join('\n');
}

/* ─────────── Handler ─────────── */
//
// NOTE: this uses Netlify Functions V1 syntax (`export const handler`
// with an event/context signature) because `submission-created` is one
// of the magic background function names that Netlify invokes via the
// V1 runtime - V2 (`export default async (req)`) doesn't get wired up
// for these hooks and errors with "handler is undefined or not exported".

export const handler = async (event) => {
  // Always log on invocation so we know the function fired. The Netlify
  // event payload for trigger functions doesn't always include httpMethod,
  // so we no longer gate on it - submission-created is only ever called
  // by Netlify Forms, never by a public HTTP request.
  console.log('[submission-created] invoked', {
    hasBody: !!event.body,
    bodyType: typeof event.body,
    httpMethod: event.httpMethod,
  });

  // event.body may be a JSON string (the HTTP-wrapped case) OR an already-
  // parsed object (some Netlify Functions runtime variants). Handle both.
  let body = {};
  if (event.body) {
    if (typeof event.body === 'string') {
      try {
        body = JSON.parse(event.body);
      } catch (err) {
        console.log('[submission-created] bad JSON body, raw:', event.body.slice(0, 200));
        return { statusCode: 400, body: 'Bad JSON' };
      }
    } else {
      body = event.body;
    }
  } else if (event.payload) {
    // Some trigger-function invocations put the payload at the top level.
    body = event;
  }

  // Trigger invocations wrap the submission in `payload`; outbound URL
  // notifications post it at the top level. Handle both.
  const submission = body?.payload || body || {};
  const formName   = submission.form_name || submission.name;
  const data       = submission.data || {};

  if (formName !== 'committee-contact') {
    console.log(`[submission-created] ignoring form: ${formName}`);
    return { statusCode: 200, body: 'Form not handled' };
  }

  // Server-side honeypot. Real visitors leave bot-field empty; bots fill
  // every field. Return 200 so the bot doesn't realise it was filtered.
  if ((data['bot-field'] || '').trim()) {
    console.log('[submission-created] honeypot tripped, dropping');
    return { statusCode: 200, body: 'OK' };
  }

  const recipient = (data.recipient || '').trim();
  const name      = (data.name      || '').trim();
  const email     = (data.email     || '').trim();
  const subject   = (data.subject   || '(no subject)').trim();
  const message   = (data.message   || '').trim();

  if (!name || !email || !message) {
    console.log('[submission-created] missing required fields');
    return { statusCode: 400, body: 'Missing fields' };
  }

  const realRecipientEmail = COMMITTEE[recipient] || FALLBACK;
  const targetEmail = TEST_OVERRIDE_TO || realRecipientEmail;
  if (TEST_OVERRIDE_TO) {
    console.log(
      `[submission-created] TEST MODE - overriding ${realRecipientEmail} → ${TEST_OVERRIDE_TO}`
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[submission-created] RESEND_API_KEY not set');
    return { statusCode: 500, body: 'Email service not configured' };
  }

  const subjectLine = `[KERNO website] ${subject}`;

  const payload = {
    from: FROM_ADDRESS,
    to: [targetEmail],
    reply_to: email,
    subject: subjectLine,
    html: buildHtml({ recipient, name, email, subject, message }),
    text: buildText({ recipient, name, email, subject, message }),
  };

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[submission-created] Resend error', res.status, errBody);
      return { statusCode: 500, body: 'Email send failed' };
    }

    const result = await res.json();
    console.log(
      `[submission-created] routed to ${recipient} <${targetEmail}>, ` +
      `Resend id=${result.id || '?'}`
    );
    return { statusCode: 200, body: 'OK' };
  } catch (err) {
    console.error('[submission-created] fetch error:', err.message);
    return { statusCode: 500, body: 'Email send failed' };
  }
};
