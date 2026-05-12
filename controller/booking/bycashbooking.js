const BookingSchema = require("../../models/BookingSchema");
const Service = require("../../models/ServiceSchema");
const User = require("../../models/userSchema");
const AvailabilitySchema = require("../../models/AvailabilitySchema");
const TherapistProfile = require("../../models/TherapistProfiles");
const Coupon = require("../../models/CouponSchema");
const sendMail = require("../../utils/sendmail");
const sendCustomSMS = require("../../utils/smsService");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

/**
 * Helper to split availability blocks after a booking
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

    const blockStart = bh * 60 + bm; // block start in minutes
    const blockEnd = eh * 60 + em;
    const bookingStart =
      slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();
    // Use duration so a slot ending at 00:00 next day (e.g. 23:30 booking)
    // is correctly represented as 1440, not 0 — otherwise the split math
    // silently fails and the slot stays marked available.
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

// ✅ Helper to generate random password
function generateRandomPassword(length = 10) {
  return crypto.randomBytes(length)
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, length);
}

const createBooking = async (req, res) => {
  try {
    const {
      couponCode,
      email,
      therapistId,
      serviceId,
      optionIndex,
      ritualPurchaseid,
      date,
      time,
      notes,
      name,
      phone,
      address
    } = req.body;
console.log(req.body)
    if (
      !email ||
      !therapistId ||
      !serviceId ||
      !date ||
      !time ||
      optionIndex === undefined
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const ritualPurchaseId = ritualPurchaseid || null;

    // ✅ Find or create client user
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      const autoPassword = generateRandomPassword();
      const hashedPassword = await bcrypt.hash(autoPassword, 10);
let updatedname = '';
      if (typeof name === "string" && name.trim() !== "") {
  const parts = name.trim().split(/\s+/); // split by any amount of spaces
  updatedname = {
    first: parts[0],
    last: parts.slice(1).join(" ") || "",
  };
} else if (typeof name === "object" && name !== null) {
  updatedname = {
    first: name.first || "Guest",
    last: name.last || "",
  };
} else {
  updatedname = {
    first: "Guest",
    last: "",
  };
}
let updatedphone = '44'+phone
console.log(name)
      user = await User.create({
        name: updatedname,
        email: email.toLowerCase(),
        passwordHash: hashedPassword,
        phone: updatedphone || null,
        role: "client",
        emailVerified: false,
        address: address || {}, // optional if provided
      });
 

      console.log(`✅ Auto-created new user for ${email} with password: ${autoPassword}`);
      
//client mail for password
 let clientpasswordmail = `
  <h2>Welcome to Noira</h2>
  <p>Dear ${updatedname.first},</p>
  
  <p>For your convenience, we have created a Noira account to make your future bookings seamless.</p>
  
  <h3>Your Login Details</h3>
  <p><strong>Email:</strong> ${email}</p>
  <p><strong>Password:</strong> ${autoPassword}</p>
  
  <p>Please log in anytime to view your bookings, manage your preferences, and enjoy a more personalised Noira experience.</p>
  
  <p>With discretion and care,<br>The Noira Team</p>
`;

try {
  await sendMail(user.email, "Login password - Noira", clientpasswordmail, "otp");
} catch (mailErr) {
  console.error("[cashBooking] welcome mail failed:", mailErr?.message || mailErr);
}

      // (Optional) send email with credentials here
    }



    // Parse date + time in UTC
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = new Date(
      Date.UTC(year, month - 1, day, hours, minutes, 0, 0)
    );

    if (isNaN(slotStart.getTime())) {
      return res.status(400).json({ error: "Invalid date or time format" });
    }

    const serviceDoc = await Service.findById(serviceId);
    if (!serviceDoc)
      return res.status(404).json({ error: "Service not found" });

    const option = serviceDoc.options[optionIndex];
    if (!option) return res.status(400).json({ error: "Invalid option index" });

    const slotEnd = new Date(slotStart.getTime() + option.durationMinutes * 60000);

    // Price calculation
    let finalPrice = option.price.amount;
    let surcharge = false;
    const hour = parseInt(
      new Date(slotStart).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        hour: "2-digit",
        hour12: false,
      }),
      10
    );

    if (hour >= 23 || hour < 9) {
      surcharge = true;
      finalPrice += 15;
    }

    let appliedCouponId = null;
    let appliedCouponCode = null;
    let discountAmount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.trim().toUpperCase() });
      if (coupon && coupon.isActive
        && (!coupon.expiryDate || new Date() <= coupon.expiryDate)
        && (coupon.maxUses === 0 || coupon.usedCount < coupon.maxUses)
        && finalPrice >= coupon.minOrderAmount
      ) {
        const priceBeforeDiscount = finalPrice;
        if (coupon.type === "percentage") {
          finalPrice = Math.round((finalPrice * (1 - coupon.value / 100)) * 100) / 100;
        } else if (coupon.type === "fixed") {
          finalPrice = Math.max(0, finalPrice - coupon.value);
        } else if (coupon.type === "free") {
          finalPrice = 0;
        }
        discountAmount = Math.round((priceBeforeDiscount - finalPrice) * 100) / 100;
        appliedCouponId = coupon._id;
        appliedCouponCode = coupon.code;
        coupon.usedCount += 1;
        await coupon.save();
      }
    }

    const newdate = new Date(slotStart);
    newdate.setUTCHours(0, 0, 0, 0);

    // ✅ Create booking
    const booking = await BookingSchema.create({
      clientId: user._id,
      serviceId,
      therapistId,
      ritualPurchaseId,
      date: newdate,
      slotStart,
      slotEnd,
      status: "confirmed",
      paymentStatus: "pending",
      paymentMode: "cash",
      price: { amount: finalPrice, currency: "gbp" },
      eliteHourSurcharge: surcharge,
      notes,
      couponId: appliedCouponId,
      couponCode: appliedCouponCode,
      discountAmount,
    });

    // ✅ Block therapist availability — handle overnight bookings by
    // splitting today's block (slotStart → end-of-today) AND tomorrow's
    // block (start-of-tomorrow → slotEnd) when the booking crosses midnight.
    const endOfToday = new Date(newdate);
    endOfToday.setUTCHours(24, 0, 0, 0); // = next day 00:00 UTC
    const isOvernightBooking = slotEnd > endOfToday;

    const todayDoc = await AvailabilitySchema.findOne({
      therapistId,
      date: newdate,
    });
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
      const tomorrowStart = endOfToday; // tomorrow 00:00
      const tomorrowDay = new Date(tomorrowStart);
      tomorrowDay.setUTCHours(0, 0, 0, 0);
      const tomorrowDoc = await AvailabilitySchema.findOne({
        therapistId,
        date: tomorrowDay,
      });
      if (tomorrowDoc) {
        tomorrowDoc.blocks = blockBookedSlot(
          tomorrowDoc.blocks,
          tomorrowStart,
          slotEnd
        );
        await tomorrowDoc.save();
      }
    }

    // ✅ Populate booking with all details
    const bookingnew = await BookingSchema.findById(booking._id)
      .populate("therapistId")
      .populate("clientId")
      .populate("serviceId");

    const therapist = await TherapistProfile.findById(
      bookingnew.therapistId
    ).populate("userId");

    const start = new Date(bookingnew.slotStart);
    const end = new Date(bookingnew.slotEnd);

    const startUTC = `${String(start.getUTCHours()).padStart(2, "0")}:${String(
      start.getUTCMinutes()
    ).padStart(2, "0")}`;
    const endUTC = `${String(end.getUTCHours()).padStart(2, "0")}:${String(
      end.getUTCMinutes()
    ).padStart(2, "0")}`;

    const durationMinutes = Math.round((end - start) / (1000 * 60));


    // ✅ Emails and SMS notifications stay the same
    const clientMail = `
      <h2>Booking Confirmed</h2>
      <p>Dear ${bookingnew.clientId?.name?.first} ${
        bookingnew.clientId?.name?.last
      },</p>
      <p>Your appointment at Noira Massage Therapy is confirmed.</p>
      <p><strong>BookingId:</strong> ${bookingnew._id}</p>
      <p><strong>Date:</strong> ${bookingnew.date.toDateString()}</p>
      <p><strong>Time:</strong> ${startUTC}</p>
      <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
      <p><strong>Service:</strong> ${bookingnew.serviceId.name}</p>
      <p><strong>Price:</strong> £${bookingnew.price.amount}</p>
      <p><strong>Payment Mode:</strong> ${bookingnew.paymentMode}</p>
      <p><strong>Location:</strong> ${bookingnew.clientId.address?.Building_No || ""}, 
        ${bookingnew.clientId.address?.Street || ""}, 
        ${bookingnew.clientId.address?.Locality || ""}, 
        ${bookingnew.clientId.address?.PostalCode || ""}</p>
      <p>Best regards,<br>Team NOIRA</p>
    `;

      const therapistMail = `
    <h2>New Booking Alert</h2>
    <p>Dear ${bookingnew.therapistId.title},</p>
    <p>You have a new booking. Please find the details below:</p>
    <p><strong>BookingId:</strong> ${bookingnew._id}</p>
    <p><strong>BookingId:</strong> ${bookingnew._id}</p>
    <p><strong>Client:</strong> ${bookingnew.clientId.name.first} ${
      bookingnew.clientId.name.last}</p>
    <p><strong>Contact:</strong> ${bookingnew.clientId.phone}</p>
    <p><strong>Service:</strong> ${bookingnew.serviceId.name}</p>
    <p><strong>Date:</strong> ${bookingnew.date.toDateString()}</p>
    <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
    <p><strong>Time:</strong> ${startUTC} - ${endUTC}</p>
    <p><strong>Price:</strong> £${bookingnew.price.amount}</p>
    <p><strong>Payment Mode:</strong> ${
      bookingnew.paymentMode
    }</p>
    <p><strong>Location:</strong></p>
    <p><strong>${bookingnew.clientId.address.Building_No}, ${
      bookingnew.clientId.address.Street
    }, ${bookingnew.clientId.address.Locality}, ${
      bookingnew.clientId.address.PostalCode
    }</strong></p>
    <p>For any assistance, please call us at  +44 7350 700055.</p>
    <p>Best regards,<br>Team NOIRA</p>
`;

const adminMail = `
  <h2>New Booking Notification</h2>
  <p><strong>BookingId:</strong> ${bookingnew._id}</p>
  <h3>Client Details</h3>
  <p><strong>Name:</strong> ${bookingnew.clientId?.name?.first} ${bookingnew.clientId?.name?.last}</p>
  <p><strong>Contact:</strong> ${bookingnew.clientId?.phone}</p>
  <p><strong>Address:</strong> ${bookingnew.clientId.address.Building_No}, ${bookingnew.clientId.address.Street}, ${bookingnew.clientId.address.Locality}, ${bookingnew.clientId.address.PostalCode}</p>

  <h3>Therapist Details</h3>
  <p><strong>Name / Title:</strong> ${bookingnew.therapistId.title}</p>

  <h3>Booking Details</h3>
  <p><strong>Date:</strong> ${bookingnew.date.toDateString()}</p>
  <p><strong>Time:</strong> ${startUTC} - ${endUTC}</p>
  <p><strong>Duration:</strong> ${durationMinutes} minutes</p>
  <p><strong>Service:</strong> ${bookingnew.serviceId.name}</p>
  <p><strong>Price:</strong> £${bookingnew.price.amount}</p>
  <p><strong>Payment Mode:</strong> ${bookingnew.paymentMode}</p>
  
  <p>Best regards,<br>Team NOIRA</p>
`;


    const message = `Your NOIRA massage is confirmed for ${bookingnew.date.toLocaleDateString(
      "en-GB")}, ${startUTC} ${durationMinutes}mins. Therapist - ${bookingnew.therapistId.title}.`;

    // Notifications must not fail the booking response. The DB write has
    // already succeeded by this point; mail/SMS providers (Microsoft Graph,
    // MSG91) can be down or rate-limited without that meaning the booking
    // didn't happen. Fire them in parallel via allSettled and log failures.
    const notifyResults = await Promise.allSettled([
      sendMail(bookingnew.clientId.email, "Booking Confirmation - Noira", clientMail, "booking"),
      sendMail(therapist.userId.email, "New Booking Alert - Noira", therapistMail, "booking"),
      sendMail("bookings@noira.co.uk", "New Booking Notification", adminMail, "booking"),
      sendCustomSMS(bookingnew.clientId.phone, message),
      sendCustomSMS(therapist.userId.phone, `NEW booking: ${message}`),
    ]);
    notifyResults.forEach((r, i) => {
      if (r.status === "rejected") {
        console.error(`[cashBooking] notification ${i} failed:`, r.reason?.message || r.reason);
      }
    });

    return res.status(200).json({ message: "Booking confirmed" });

  } catch (error) {
    console.error("Booking creation failed:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
};

module.exports = createBooking;
