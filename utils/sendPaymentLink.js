const sendCustomSMS = require("./smsService");
const sendMail = require("./sendmail");

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
        // customerPhone is stored without leading "+" (e.g. 447...).
        const toNumber = customerPhone.startsWith("+")
          ? customerPhone
          : `+${customerPhone}`;
        await twilio.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
          to: `whatsapp:${toNumber}`,
          body: smsBody,
        });
        result.sent.push("whatsapp");
      } catch (err) {
        result.failed.push({
          channel: "whatsapp",
          error: err?.message || String(err),
        });
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
