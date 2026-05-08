const Stripe = require("stripe");
const Booking = require("../../../models/BookingSchema");
const Service = require("../../../models/ServiceSchema");
const Payment = require("../../../models/PaymentSchema");
const sendPaymentLink = require("../../../utils/sendPaymentLink");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * POST /api/admin/booking/:id/resend-link
 * Body: { channels?: ["sms"|"whatsapp"|"email"] }
 *
 * Re-sends the payment link to the customer. If the existing Stripe session
 * is missing or expired, a fresh session is created and persisted.
 */
const resendPaymentLink = async (req, res) => {
  try {
    if (!stripe) {
      return res
        .status(503)
        .json({ message: "Stripe not configured" });
    }

    const { id } = req.params;
    const channels = Array.isArray(req.body?.channels) && req.body.channels.length
      ? req.body.channels
      : ["sms"];

    const validChannels = ["sms", "whatsapp", "email"];
    if (!channels.every((c) => validChannels.includes(c))) {
      return res.status(400).json({ message: "Invalid channels" });
    }

    const booking = await Booking.findById(id)
      .populate("clientId")
      .populate("serviceId");
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.source !== "admin-manual") {
      return res
        .status(400)
        .json({ message: "Only admin-manual bookings support resend" });
    }
    if (booking.status === "confirmed" || booking.paymentStatus === "paid") {
      return res
        .status(400)
        .json({ message: "Booking is already confirmed/paid" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking is cancelled" });
    }

    // ── Try to reuse the existing session if still open ─────────────────
    let session = null;
    if (booking.paymentLinkSessionId) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(
          booking.paymentLinkSessionId
        );
        if (
          existing &&
          existing.status === "open" &&
          existing.url &&
          // Stripe URLs expire — double-check expires_at
          (!existing.expires_at ||
            existing.expires_at * 1000 > Date.now() + 60 * 1000)
        ) {
          session = existing;
        }
      } catch (e) {
        // fall through and create fresh
      }
    }

    // ── Create a fresh session if needed ────────────────────────────────
    if (!session) {
      const serviceDoc = booking.serviceId;
      const amount = Math.round(booking.price.amount * 100);
      const customerEmail =
        booking.clientId?.email && !booking.clientId.email.endsWith("@noira.local")
          ? booking.clientId.email
          : undefined;

      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "link"],
        mode: "payment",
        ...(customerEmail ? { customer_email: customerEmail } : {}),
        customer_creation: "if_required",
        expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        client_reference_id: booking._id.toString(),
        payment_intent_data: {
          description: `Booking ${serviceDoc.name} (admin-manual resend)`,
          metadata: {
            bookingId: booking._id.toString(),
            clientId: booking.clientId._id.toString(),
            source: "admin-manual",
          },
        },
        line_items: [
          {
            price_data: {
              currency: "gbp",
              product_data: {
                name: serviceDoc.name,
                description: `Booking ID: ${booking._id}`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        adaptive_pricing: { enabled: false },
        success_url: `${process.env.FRONTEND_URL}/paymentsuccess?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/paymentfailed`,
        metadata: {
          bookingId: booking._id.toString(),
          serviceName: serviceDoc.name,
          source: "admin-manual",
        },
      });

      booking.paymentLinkUrl = session.url;
      booking.paymentLinkSessionId = session.id;

      // Reset payment record to pending in case the prior one was marked failed
      await Payment.findOneAndUpdate(
        { bookingId: booking._id },
        {
          paymentStatus: "pending",
          status: "pending",
          stripeCheckoutSessionId: session.id,
        },
        { upsert: true }
      );
    }

    // ── Send via requested channels ─────────────────────────────────────
    const start = new Date(booking.slotStart);
    const startUTC = `${String(start.getUTCHours()).padStart(2, "0")}:${String(
      start.getUTCMinutes()
    ).padStart(2, "0")}`;
    const durationMin = Math.round(
      (new Date(booking.slotEnd) - start) / 60000
    );

    const customerEmail =
      booking.clientId?.email && !booking.clientId.email.endsWith("@noira.local")
        ? booking.clientId.email
        : null;

    const delivery = await sendPaymentLink({
      channels,
      customerName: booking.clientId?.name?.first || "there",
      customerPhone: booking.clientId?.phone || null,
      customerEmail,
      bookingId: booking._id,
      serviceName: booking.serviceId?.name || "your booking",
      date: booking.date.toDateString(),
      startUTC,
      durationMin,
      priceAmount: booking.price.amount,
      link: session.url,
    });

    // Merge channels: union of existing + newly-sent (no dupes)
    const existingChannels = Array.isArray(booking.paymentLinkChannels)
      ? booking.paymentLinkChannels
      : [];
    booking.paymentLinkChannels = Array.from(
      new Set([...existingChannels, ...delivery.sent])
    );
    booking.paymentLinkSentAt = new Date();
    await booking.save();

    return res.json({
      message: "Payment link re-sent",
      bookingId: booking._id,
      paymentLink: session.url,
      delivery,
    });
  } catch (err) {
    console.error("resendPaymentLink failed:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

module.exports = resendPaymentLink;
