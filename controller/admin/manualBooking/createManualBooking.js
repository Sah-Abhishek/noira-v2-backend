const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Stripe = require("stripe");
const Booking = require("../../../models/BookingSchema");
const Service = require("../../../models/ServiceSchema");
const User = require("../../../models/userSchema");
const Payment = require("../../../models/PaymentSchema");
const AvailabilitySchema = require("../../../models/AvailabilitySchema");
const TherapistProfile = require("../../../models/TherapistProfiles");
const sendMail = require("../../../utils/sendmail");
const sendCustomSMS = require("../../../utils/smsService");
const sendPaymentLink = require("../../../utils/sendPaymentLink");

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/**
 * Helper to split availability blocks after a booking — copied verbatim from
 * bycashbooking.js so behaviour stays identical.
 */
function blockBookedSlot(blocks, slotStart, slotEnd) {
  const newBlocks = [];
  blocks.forEach((block) => {
    if (!block.isAvailable) {
      newBlocks.push(block);
      return;
    }
    const [bh, bm] = block.startTime.split(":").map(Number);
    const [eh, em] = block.endTime.split(":").map(Number);
    const blockStart = bh * 60 + bm;
    const blockEnd = eh * 60 + em;
    const bookingStart =
      slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();
    // Duration-based so slots ending at 00:00 next day (23:30 booking) are
    // correctly represented as 1440 minutes, not 0.
    const durationMin = Math.round((slotEnd - slotStart) / 60000);
    const bookingEnd = bookingStart + durationMin;

    if (bookingEnd <= blockStart || bookingStart >= blockEnd) {
      newBlocks.push(block);
      return;
    }
    if (bookingStart > blockStart) {
      newBlocks.push({
        startTime: formatTime(blockStart),
        endTime: formatTime(bookingStart),
        isAvailable: true,
      });
    }
    newBlocks.push({
      startTime: formatTime(Math.max(bookingStart, blockStart)),
      endTime: formatTime(Math.min(bookingEnd, blockEnd)),
      isAvailable: false,
    });
    if (bookingEnd < blockEnd) {
      newBlocks.push({
        startTime: formatTime(bookingEnd),
        endTime: formatTime(blockEnd),
        isAvailable: true,
      });
    }
  });
  return newBlocks;
}

function formatTime(minutes) {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function generateRandomPassword(length = 10) {
  return crypto
    .randomBytes(length)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
}

function normalisePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return null;
  // Already has UK country code
  if (digits.startsWith("44")) return digits;
  // Leading 0 -> swap for 44
  if (digits.startsWith("0")) return "44" + digits.slice(1);
  return "44" + digits;
}

function parseName(name) {
  if (typeof name === "object" && name) {
    return { first: name.first || "Guest", last: name.last || "" };
  }
  if (typeof name === "string" && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return { first: parts[0], last: parts.slice(1).join(" ") };
  }
  return { first: "Guest", last: "" };
}

/**
 * POST /api/admin/booking/manual
 *
 * Body:
 *   existingClientId?  : string   - if admin picked an existing customer
 *   name               : string | { first, last }
 *   phone              : string
 *   email?             : string
 *   address            : { Building_No, Street, Locality, PostTown, PostalCode }
 *   therapistId        : string  (TherapistProfile _id)
 *   serviceId          : string
 *   optionIndex        : number
 *   date               : "YYYY-MM-DD"
 *   time               : "HH:mm" (UTC; matches existing flow)
 *   notes?             : string  (customer's SMS message text, etc.)
 *   paymentMode        : "cash" | "external" | "online" | "card-link"
 *   paymentStatus      : "pending" | "paid"     (ignored when card-link)
 *   linkChannels?      : ["sms" | "whatsapp" | "email"]   (card-link only)
 */
const createManualBooking = async (req, res) => {
  try {
    const {
      existingClientId,
      name,
      phone,
      email,
      address,
      therapistId,
      serviceId,
      optionIndex,
      date,
      time,
      notes,
      paymentMode,
      paymentStatus,
      linkChannels,
    } = req.body;

    // ── Validate required fields ────────────────────────────────────────
    const missing = [];
    if (!therapistId) missing.push("therapistId");
    if (!serviceId) missing.push("serviceId");
    if (optionIndex === undefined || optionIndex === null)
      missing.push("optionIndex");
    if (!date) missing.push("date");
    if (!time) missing.push("time");
    if (!paymentMode) missing.push("paymentMode");
    if (paymentMode !== "card-link" && !paymentStatus)
      missing.push("paymentStatus");
    if (!existingClientId && !phone) missing.push("phone");
    if (missing.length) {
      return res
        .status(400)
        .json({ message: `Missing required fields: ${missing.join(", ")}` });
    }

    if (!["cash", "external", "online", "card-link"].includes(paymentMode)) {
      return res.status(400).json({ message: "Invalid paymentMode" });
    }
    if (paymentMode !== "card-link" && !["pending", "paid"].includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid paymentStatus" });
    }
    if (paymentMode === "card-link") {
      if (!stripe) {
        return res
          .status(503)
          .json({ message: "Stripe not configured — cannot send payment link" });
      }
      const validChannels = ["sms", "whatsapp", "email"];
      const requested = Array.isArray(linkChannels) ? linkChannels : ["sms"];
      if (
        requested.length === 0 ||
        !requested.every((c) => validChannels.includes(c))
      ) {
        return res
          .status(400)
          .json({ message: "Pick at least one valid delivery channel" });
      }
    }

    // ── Resolve customer (existing OR create) ───────────────────────────
    let user;
    if (existingClientId) {
      user = await User.findById(existingClientId);
      if (!user || user.role !== "client") {
        return res
          .status(404)
          .json({ message: "Selected customer not found" });
      }
    } else {
      const normalisedPhone = normalisePhone(phone);
      if (!normalisedPhone) {
        return res.status(400).json({ message: "Invalid phone number" });
      }

      const parsedName = parseName(name);
      const lcEmail = email ? String(email).trim().toLowerCase() : null;

      // Try to match an existing client by email first, then by phone tail.
      if (lcEmail) {
        user = await User.findOne({ email: lcEmail });
      }
      if (!user) {
        const tail = normalisedPhone.slice(-9);
        const safeTail = tail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        user = await User.findOne({
          role: "client",
          phone: { $regex: `${safeTail}$` },
        });
      }

      if (!user) {
        const autoPassword = generateRandomPassword();
        const hashedPassword = await bcrypt.hash(autoPassword, 10);
        user = await User.create({
          name: parsedName,
          email: lcEmail || `manual+${normalisedPhone}@noira.local`,
          passwordHash: hashedPassword,
          phone: normalisedPhone,
          role: "client",
          emailVerified: false,
          address: address || {},
        });

        // Only email credentials if a real address was supplied.
        if (lcEmail) {
          const credentialsMail = `
            <h2>Welcome to Noira</h2>
            <p>Dear ${parsedName.first},</p>
            <p>An account was created for you so you can manage your booking.</p>
            <p><strong>Email:</strong> ${lcEmail}</p>
            <p><strong>Password:</strong> ${autoPassword}</p>
            <p>With discretion and care,<br>The Noira Team</p>
          `;
          // Fire-and-forget — don't block booking creation if mail fails.
          sendMail(
            lcEmail,
            "Login password - Noira",
            credentialsMail,
            "otp"
          ).catch((e) => console.error("credentials mail failed:", e.message));
        }
      } else if (address && (!user.address || !user.address.PostalCode)) {
        // Fill in address if we have one and the user doesn't.
        user.address = address;
        await user.save();
      }
    }

    // ── Parse date + time exactly like the existing cash flow ───────────
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = new Date(
      Date.UTC(year, month - 1, day, hours, minutes, 0, 0)
    );
    if (isNaN(slotStart.getTime())) {
      return res.status(400).json({ message: "Invalid date or time" });
    }

    const dayStart = new Date(slotStart);
    dayStart.setUTCHours(0, 0, 0, 0);
    if (slotStart < new Date()) {
      return res
        .status(400)
        .json({ message: "Slot is in the past" });
    }

    // ── Service / option ────────────────────────────────────────────────
    const serviceDoc = await Service.findById(serviceId);
    if (!serviceDoc) {
      return res.status(404).json({ message: "Service not found" });
    }
    const option = serviceDoc.options[optionIndex];
    if (!option) {
      return res.status(400).json({ message: "Invalid option index" });
    }
    const slotEnd = new Date(
      slotStart.getTime() + option.durationMinutes * 60000
    );

    // ── Therapist profile ───────────────────────────────────────────────
    const therapist = await TherapistProfile.findById(therapistId).populate(
      "userId"
    );
    if (!therapist || !therapist.active) {
      return res
        .status(400)
        .json({ message: "Therapist not found or inactive" });
    }

    // ── Validate availability (must be covered by merged blocks; supports
    //    overnight bookings spanning today + tomorrow) ───────────────────
    const endOfToday = new Date(dayStart);
    endOfToday.setUTCHours(24, 0, 0, 0);
    const isOvernightBooking = slotEnd > endOfToday;
    const tomorrowDay = new Date(endOfToday);
    tomorrowDay.setUTCHours(0, 0, 0, 0);
    const relevantDays = isOvernightBooking
      ? [dayStart, tomorrowDay]
      : [dayStart];

    const availabilityDocs = await AvailabilitySchema.find({
      therapistId,
      date: { $in: relevantDays },
    });

    const availableIntervals = [];
    for (const av of availabilityDocs) {
      for (const b of av.blocks) {
        if (!b.isAvailable) continue;
        const [bh, bm] = b.startTime.split(":").map(Number);
        const [eh, em] = b.endTime.split(":").map(Number);
        const s = new Date(av.date);
        s.setUTCHours(bh, bm, 0, 0);
        const e = new Date(av.date);
        e.setUTCHours(eh, em, 0, 0); // 24 → next day 00:00
        availableIntervals.push({ start: s, end: e });
      }
    }
    availableIntervals.sort((a, b) => a.start - b.start);
    const merged = [];
    for (const iv of availableIntervals) {
      const last = merged[merged.length - 1];
      if (last && iv.start.getTime() <= last.end.getTime()) {
        if (iv.end.getTime() > last.end.getTime()) last.end = iv.end;
      } else {
        merged.push({ start: iv.start, end: iv.end });
      }
    }
    const fits = merged.some(
      (m) => slotStart >= m.start && slotEnd <= m.end
    );
    if (!fits) {
      return res.status(409).json({
        message:
          "Therapist is not available for this slot. Please pick another time or therapist.",
      });
    }

    // ── Conflicting booking check (across both days if overnight) ───────
    const conflict = await Booking.findOne({
      therapistId,
      date: { $in: relevantDays },
      status: { $in: ["confirmed", "pending"] },
      slotStart: { $lt: slotEnd },
      slotEnd: { $gt: slotStart },
    });
    if (conflict) {
      return res.status(409).json({
        message: "Therapist already has a booking overlapping this slot.",
      });
    }

    // ── Pricing — surcharge mirrors cash flow ───────────────────────────
    let finalPrice = option.price.amount;
    let surcharge = false;
    const londonHour = parseInt(
      slotStart.toLocaleString("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        hour12: false,
      }),
      10
    );
    if (londonHour >= 23 || londonHour < 9) {
      surcharge = true;
      finalPrice += 15;
    }

    // ── Create booking ──────────────────────────────────────────────────
    // For card-link mode the booking is held as `pending` until the customer
    // pays via the Stripe link — Stripe webhook then flips it to `confirmed`.
    const isCardLink = paymentMode === "card-link";
    const booking = await Booking.create({
      clientId: user._id,
      serviceId,
      therapistId,
      date: dayStart,
      slotStart,
      slotEnd,
      status: isCardLink ? "pending" : "confirmed",
      paymentStatus: isCardLink ? "pending" : paymentStatus,
      paymentMode,
      price: { amount: finalPrice, currency: "gbp" },
      eliteHourSurcharge: surcharge,
      notes: notes || null,
      source: "admin-manual",
      createdByAdminId: req.user?._id || req.admin?._id || null,
      customerNameSnapshot: `${user.name?.first || ""} ${user.name?.last || ""}`.trim(),
      customerPhoneSnapshot: user.phone || null,
    });

    // ── Block availability slot (split across days for overnight) ───────
    const todayDoc = availabilityDocs.find(
      (d) => d.date.getTime() === dayStart.getTime()
    );
    if (todayDoc) {
      const todayPortionEnd = isOvernightBooking ? endOfToday : slotEnd;
      todayDoc.blocks = blockBookedSlot(
        todayDoc.blocks,
        slotStart,
        todayPortionEnd
      );
      await todayDoc.save();
    }
    if (isOvernightBooking) {
      const tomorrowDoc = availabilityDocs.find(
        (d) => d.date.getTime() === tomorrowDay.getTime()
      );
      if (tomorrowDoc) {
        tomorrowDoc.blocks = blockBookedSlot(
          tomorrowDoc.blocks,
          endOfToday, // tomorrow 00:00
          slotEnd
        );
        await tomorrowDoc.save();
      }
    }

    // ── Populate for notifications ──────────────────────────────────────
    const bookingnew = await Booking.findById(booking._id)
      .populate("therapistId")
      .populate("clientId")
      .populate("serviceId");

    const startUTC = `${String(slotStart.getUTCHours()).padStart(
      2,
      "0"
    )}:${String(slotStart.getUTCMinutes()).padStart(2, "0")}`;
    const endUTC = `${String(slotEnd.getUTCHours()).padStart(2, "0")}:${String(
      slotEnd.getUTCMinutes()
    ).padStart(2, "0")}`;
    const durationMinutes = Math.round((slotEnd - slotStart) / 60000);

    // ── Card-link branch ────────────────────────────────────────────────
    // Create a Stripe Checkout Session, send the link via the requested
    // channels, and return early. The booking stays in `pending` until the
    // Stripe webhook fires `checkout.session.completed`.
    if (isCardLink) {
      const amount = Math.round(finalPrice * 100);
      const customerEmail = user.email && !user.email.endsWith("@noira.local")
        ? user.email
        : undefined;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "link"],
        mode: "payment",
        ...(customerEmail ? { customer_email: customerEmail } : {}),
        customer_creation: "if_required",
        // 24h expiry — phone bookings often need a longer window than the 30m
        // used for the online flow.
        expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        client_reference_id: booking._id.toString(),
        payment_method_options: {
          card: { request_three_d_secure: "automatic" },
        },
        payment_intent_data: {
          description: `Booking ${serviceDoc.name} on ${dayStart.toDateString()} (admin-manual)`,
          metadata: {
            bookingId: booking._id.toString(),
            clientId: user._id.toString(),
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
        success_url: `${process.env.FRONTEND_URL}/paymentsuccess?session_id={CHECKOUT_SESSION_ID}&userId=${user._id}&PostalCode=${encodeURIComponent(user.address?.PostalCode || "")}`,
        cancel_url: `${process.env.FRONTEND_URL}/paymentfailed`,
        metadata: {
          bookingId: booking._id.toString(),
          serviceName: serviceDoc.name,
          source: "admin-manual",
        },
      });

      // Persist payment record (mirrors online flow)
      await Payment.create({
        bookingId: booking._id,
        userId: booking.clientId,
        provider: "stripe",
        amount: finalPrice,
        status: "pending",
        method: "card-link",
      });

      // Save link details on booking
      booking.paymentLinkUrl = session.url;
      booking.paymentLinkSessionId = session.id;
      booking.paymentLinkSentAt = new Date();
      booking.paymentLinkChannels = [];
      await booking.save();

      // Send via requested channels
      const dateStr = dayStart.toDateString();
      const delivery = await sendPaymentLink({
        channels: linkChannels || ["sms"],
        customerName: user.name?.first || "there",
        customerPhone: user.phone || null,
        customerEmail: customerEmail || null,
        bookingId: booking._id,
        serviceName: serviceDoc.name,
        date: dateStr,
        startUTC,
        durationMin: durationMinutes,
        priceAmount: finalPrice,
        link: session.url,
      });

      booking.paymentLinkChannels = delivery.sent;
      await booking.save();

      // Notify admin/internal team that a pending-payment booking exists
      sendMail(
        "bookings@noira.co.uk",
        "Pending payment — admin-manual booking",
        `<h2>Pending payment booking</h2>
         <p><strong>Booking ID:</strong> ${booking._id}</p>
         <p><strong>Customer:</strong> ${user.name?.first || ""} ${user.name?.last || ""} · ${user.phone || ""}</p>
         <p><strong>Service:</strong> ${serviceDoc.name} · ${dateStr} ${startUTC} (${durationMinutes} min)</p>
         <p><strong>Amount:</strong> £${finalPrice}</p>
         <p><strong>Link:</strong> <a href="${session.url}">${session.url}</a></p>
         <p><strong>Sent via:</strong> ${delivery.sent.join(", ") || "(none)"}</p>
         ${delivery.failed.length ? `<p><strong>Failed:</strong> ${JSON.stringify(delivery.failed)}</p>` : ""}
         ${delivery.skipped.length ? `<p><strong>Skipped:</strong> ${JSON.stringify(delivery.skipped)}</p>` : ""}`,
        "booking"
      ).catch((e) => console.error("admin notify failed:", e.message));

      return res.status(201).json({
        message: "Payment link sent. Booking is pending until paid.",
        bookingId: booking._id,
        paymentLink: session.url,
        delivery,
      });
    }

    const addr = bookingnew.clientId?.address || {};
    const addressLine = [
      addr.Building_No,
      addr.Street,
      addr.Locality,
      addr.PostalCode,
    ]
      .filter(Boolean)
      .join(", ");

    const clientFirst = bookingnew.clientId?.name?.first || "Guest";
    const clientLast = bookingnew.clientId?.name?.last || "";

    // ── Notifications (mirror bycashbooking, with optional email) ───────
    const clientMail = `
      <h2>Booking Confirmed</h2>
      <p>Dear ${clientFirst} ${clientLast},</p>
      <p>Your appointment at Noira Massage Therapy is confirmed.</p>
      <p><strong>BookingId:</strong> ${bookingnew._id}</p>
      <p><strong>Date:</strong> ${bookingnew.date.toDateString()}</p>
      <p><strong>Time:</strong> ${startUTC}</p>
      <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
      <p><strong>Service:</strong> ${bookingnew.serviceId.name}</p>
      <p><strong>Price:</strong> £${bookingnew.price.amount}</p>
      <p><strong>Payment Mode:</strong> ${bookingnew.paymentMode}</p>
      <p><strong>Location:</strong> ${addressLine}</p>
      <p>Best regards,<br>Team NOIRA</p>
    `;

    const therapistMail = `
      <h2>New Booking Alert</h2>
      <p>Dear ${bookingnew.therapistId.title},</p>
      <p>You have a new booking (created by admin).</p>
      <p><strong>BookingId:</strong> ${bookingnew._id}</p>
      <p><strong>Client:</strong> ${clientFirst} ${clientLast}</p>
      <p><strong>Contact:</strong> ${bookingnew.clientId?.phone || ""}</p>
      <p><strong>Service:</strong> ${bookingnew.serviceId.name}</p>
      <p><strong>Date:</strong> ${bookingnew.date.toDateString()}</p>
      <p><strong>Time:</strong> ${startUTC} - ${endUTC}</p>
      <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
      <p><strong>Price:</strong> £${bookingnew.price.amount}</p>
      <p><strong>Payment Mode:</strong> ${bookingnew.paymentMode}</p>
      <p><strong>Location:</strong> ${addressLine}</p>
      ${notes ? `<p><strong>Customer note:</strong> ${notes}</p>` : ""}
      <p>For any assistance, please call us at +44 7350 700055.</p>
      <p>Best regards,<br>Team NOIRA</p>
    `;

    const adminMail = `
      <h2>New Booking Notification (Admin Created)</h2>
      <p><strong>BookingId:</strong> ${bookingnew._id}</p>
      <p><strong>Source:</strong> admin-manual / SMS</p>
      <h3>Client</h3>
      <p><strong>Name:</strong> ${clientFirst} ${clientLast}</p>
      <p><strong>Contact:</strong> ${bookingnew.clientId?.phone || ""}</p>
      <p><strong>Address:</strong> ${addressLine}</p>
      <h3>Therapist</h3>
      <p><strong>Title:</strong> ${bookingnew.therapistId.title}</p>
      <h3>Booking</h3>
      <p><strong>Date:</strong> ${bookingnew.date.toDateString()}</p>
      <p><strong>Time:</strong> ${startUTC} - ${endUTC}</p>
      <p><strong>Service:</strong> ${bookingnew.serviceId.name}</p>
      <p><strong>Price:</strong> £${bookingnew.price.amount}</p>
      <p><strong>Payment:</strong> ${bookingnew.paymentMode} / ${bookingnew.paymentStatus}</p>
      ${notes ? `<p><strong>Customer note:</strong> ${notes}</p>` : ""}
    `;

    // Email is optional for the customer — only send if we have a real address
    const customerEmail = bookingnew.clientId?.email;
    const isPlaceholderEmail =
      typeof customerEmail === "string" && customerEmail.endsWith("@noira.local");

    const mailJobs = [];
    if (customerEmail && !isPlaceholderEmail) {
      mailJobs.push(
        sendMail(customerEmail, "Booking Confirmation - Noira", clientMail, "booking")
      );
    }
    if (bookingnew.therapistId?.userId) {
      const therapistUser = await User.findById(bookingnew.therapistId.userId);
      if (therapistUser?.email) {
        mailJobs.push(
          sendMail(
            therapistUser.email,
            "New Booking Alert - Noira",
            therapistMail,
            "booking"
          )
        );
      }
    }
    mailJobs.push(
      sendMail(
        "bookings@noira.co.uk",
        "New Booking Notification (Admin)",
        adminMail,
        "booking"
      )
    );

    // SMS — always to customer (manual bookings come from SMS) and to therapist
    const smsMessage = `Your NOIRA massage is confirmed for ${bookingnew.date.toLocaleDateString(
      "en-GB"
    )}, ${startUTC} ${durationMinutes}mins. Therapist - ${bookingnew.therapistId.title}.`;

    if (bookingnew.clientId?.phone) {
      mailJobs.push(sendCustomSMS(bookingnew.clientId.phone, smsMessage));
    }
    const therapistUserForSms = await User.findById(
      bookingnew.therapistId.userId
    );
    if (therapistUserForSms?.phone) {
      mailJobs.push(
        sendCustomSMS(
          therapistUserForSms.phone,
          `NEW booking (admin): ${smsMessage}`
        )
      );
    }

    // Run notifications in parallel; surface partial failures but don't roll
    // back — booking is already saved.
    const results = await Promise.allSettled(mailJobs);
    const notificationErrors = results
      .filter((r) => r.status === "rejected")
      .map((r) => r.reason?.message || String(r.reason));

    return res.status(201).json({
      message: "Manual booking confirmed",
      bookingId: bookingnew._id,
      booking: bookingnew,
      notificationErrors,
    });
  } catch (error) {
    console.error("Manual booking creation failed:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

function slotEndMinFromDate(d) {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

module.exports = createManualBooking;
