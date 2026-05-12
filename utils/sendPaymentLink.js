const sendCustomSMS = require("./smsService");
const sendMail = require("./sendmail");

// Normalize a phone string to E.164 (UK-default). Customers / admins enter
// numbers in mixed formats — "07869...", "447869...", "+44 7869 ...",
// "00447869..." — and Twilio rejects anything that isn't strict E.164.
function toE164UK(raw) {
  if (!raw) return "";
  // strip everything except digits and a leading +
  let s = String(raw).trim().replace(/[^\d+]/g, "");
  if (s.startsWith("+")) return "+" + s.slice(1).replace(/\D/g, "");
  if (s.startsWith("00")) return "+" + s.slice(2);
  if (s.startsWith("0")) return "+44" + s.slice(1);   // UK domestic
  if (s.startsWith("44")) return "+" + s;
  return "+" + s;
}

/**
 * Send a Stripe Checkout link to a customer via the requested channels.
 *
 * Channels supported:
 *   - "sms"      — uses MSG91 sendCustomSMS (always available)
 *   - "email"    — uses sendMail (only if customerEmail provided)
 *   - "whatsapp" — uses Twilio WhatsApp; only sent if TWILIO_WHATSAPP_FROM is
 *                  set in env. Otherwise reported as skipped (no error).
 *
 * Returns { sent: [...], skipped: [...], failed: [{channel,error}] } so the
 * caller can persist a real list of channels and surface partial failures.
 */
async function sendPaymentLink({
  channels = [],
  customerName,
  customerPhone,
  customerEmail,
  bookingId,
  serviceName,
  date,        // already-formatted human date string
  startUTC,    // "HH:mm"
  durationMin,
  priceAmount, // GBP integer/float
  link,        // Stripe checkout URL
}) {
  const result = { sent: [], skipped: [], failed: [] };
  const wanted = new Set((channels || []).map((c) => String(c).toLowerCase()));

  const safeName = customerName || "there";
  const smsBody =
    `NOIRA: Hi ${safeName}, please complete your booking payment securely: ${link} ` +
    `(${serviceName}, ${date} ${startUTC}, ${durationMin}min, £${priceAmount}). ` +
    `Link expires shortly.`;

  // ── SMS ──────────────────────────────────────────────────────────────
  if (wanted.has("sms")) {
    if (!customerPhone) {
      result.failed.push({ channel: "sms", error: "no phone on customer" });
    } else {
      try {
        await sendCustomSMS(customerPhone, smsBody);
        result.sent.push("sms");
      } catch (err) {
        result.failed.push({
          channel: "sms",
          error: err?.message || String(err),
        });
      }
    }
  }

  // ── WhatsApp (gated on env var) ──────────────────────────────────────
  if (wanted.has("whatsapp")) {
    if (!process.env.TWILIO_WHATSAPP_FROM) {
      result.skipped.push({
        channel: "whatsapp",
        reason: "TWILIO_WHATSAPP_FROM not configured",
      });
    } else if (!customerPhone) {
      result.failed.push({ channel: "whatsapp", error: "no phone on customer" });
    } else {
      try {
        const twilio = require("twilio")(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        const toNumber = toE164UK(customerPhone);
        await twilio.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:${toNumber}`,
          body: smsBody,
        });
        result.sent.push("whatsapp");
      } catch (err) {
        // Twilio rejects when the From number isn't a registered/approved
        // WhatsApp sender — that's an account-setup state, not a per-message
        // failure. Treat those as "skipped" so the UI stops flagging it in
        // red until the Twilio WhatsApp Business sender is approved.
        const msg = err?.message || String(err);
        const code = err?.code; // Twilio sets numeric codes like 63007
        const isChannelMisconfig =
          code === 63007 ||
          code === 63016 ||
          /could not find a Channel|not a WhatsApp|channel sender|not opted in/i.test(msg);
        if (isChannelMisconfig) {
          result.skipped.push({
            channel: "whatsapp",
            reason: "WhatsApp sender not approved on Twilio yet",
          });
        } else {
          result.failed.push({ channel: "whatsapp", error: msg });
        }
      }
    }
  }

  // ── Email ────────────────────────────────────────────────────────────
  if (wanted.has("email")) {
    if (!customerEmail) {
      result.skipped.push({
        channel: "email",
        reason: "no email on customer",
      });
    } else {
      const html = `
        <h2>Complete your NOIRA booking</h2>
        <p>Hi ${safeName},</p>
        <p>Please complete payment for your booking using the secure link below.</p>
        <p>
          <a href="${link}" style="background:#c5a366;color:#000;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:600;">
            Pay securely
          </a>
        </p>
        <p style="font-size:12px;color:#555;">If the button doesn't work, copy and paste this link: <br>${link}</p>
        <h3>Booking details</h3>
        <p>
          <strong>Service:</strong> ${serviceName}<br>
          <strong>Date:</strong> ${date}<br>
          <strong>Time:</strong> ${startUTC} (${durationMin} min)<br>
          <strong>Amount:</strong> £${priceAmount}<br>
          <strong>Booking ID:</strong> ${bookingId}
        </p>
        <p style="font-size:12px;color:#555;">If you didn't request this booking, please ignore this email.</p>
        <p>With discretion and care,<br>The Noira Team</p>
      `;
      try {
        await sendMail(
          customerEmail,
          "Complete your NOIRA booking payment",
          html,
          "booking"
        );
        result.sent.push("email");
      } catch (err) {
        result.failed.push({
          channel: "email",
          error: err?.message || String(err),
        });
      }
    }
  }

  return result;
}

module.exports = sendPaymentLink;
