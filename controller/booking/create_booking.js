const Booking = require("../../models/BookingSchema");
const Service = require("../../models/ServiceSchema");
const User = require("../../models/userSchema");
const AvailabilitySchema = require("../../models/AvailabilitySchema");
const Coupon = require("../../models/CouponSchema");
const Stripe = require("stripe");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const Payment = require("../../models/PaymentSchema");
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const sendMail = require('../../utils/sendmail')
// ✅ Helper: split availability blocks after a booking
function blockBookedSlot(blocks, slotStart, slotEnd) {
  const newBlocks = [];

  blocks.forEach(block => {
    if (!block.isAvailable) {
      newBlocks.push(block);
      return;
    }

    const [bh, bm] = block.startTime.split(":").map(Number);
    const [eh, em] = block.endTime.split(":").map(Number);

    const blockStart = bh * 60 + bm;
    const blockEnd = eh * 60 + em;
    const bookingStart = slotStart.getUTCHours() * 60 + slotStart.getUTCMinutes();
    const bookingEnd = slotEnd.getUTCHours() * 60 + slotEnd.getUTCMinutes();

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

// ✅ Helper: generate random password
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
      mobileNumber,
      PostalCode
    } = req.body;

    if (!email || !therapistId || !serviceId || !date || !time || optionIndex === undefined) {
      return res.status(400).json({ message: "Missing required fields" });
    }
if (
  !email ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
) {
  return res.status(400).json({ message: "Invalid email address." });
}
    const ritualPurchaseId = ritualPurchaseid || null;

    // ✅ Find or Create User
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
   let updatedphone = '44'+mobileNumber
         user = await User.create({
           name: updatedname,
           email: email.toLowerCase(),
           passwordHash: hashedPassword,
           phone: updatedphone || null,
           role: "client",
           emailVerified: false,
            // optional if provided
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
   await sendMail(user.email, "Login password - Noira", clientpasswordmail, "otp");
 }

let checkaddress = false;
     if(user.address !==null){
          checkaddress = true;
     }
    // Parse date & time
    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const slotStart = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0, 0));

    if (isNaN(slotStart.getTime())) {
      return res.status(400).json({ error: "Invalid date or time format" });
    }

    const serviceDoc = await Service.findById(serviceId);
    if (!serviceDoc) return res.status(404).json({ error: "Service not found" });

    const option = serviceDoc.options[optionIndex];
    if (!option) return res.status(400).json({ error: "Invalid option index" });

    const slotEnd = new Date(slotStart.getTime() + option.durationMinutes * 60000);

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
    const booking = await Booking.create({
      clientId: user._id,
      serviceId,
      therapistId,
      ritualPurchaseId,
      date: newdate,
      slotStart,
      slotEnd,
      status: "pending",
      paymentStatus: "pending",
      paymentMode: "online",
      price: { amount: finalPrice, currency: "gbp" },
      eliteHourSurcharge: surcharge,
      notes,
      couponId: appliedCouponId,
      couponCode: appliedCouponCode,
      discountAmount,
    });

    // ✅ Update therapist availability
    const availabilityDoc = await AvailabilitySchema.findOne({ therapistId, date: newdate });
    if (availabilityDoc) {
      availabilityDoc.blocks = blockBookedSlot(availabilityDoc.blocks, slotStart, slotEnd);
      await availabilityDoc.save();
    }

    // ✅ Stripe Checkout Session
    const amount = Math.round(finalPrice * 100);
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "link", "klarna", "afterpay_clearpay"],
      mode: "payment",
      customer_email: user.email,
      customer_creation: "if_required",
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      client_reference_id: booking._id.toString(),
      payment_method_options: {
        card: { request_three_d_secure: "automatic" },
      },
      payment_intent_data: {
        description: `Booking for ${serviceDoc.name} on ${booking.date.toDateString()}`,
        metadata: {
          bookingId: booking._id.toString(),
          clientId: user._id.toString(),
          clientName: `${user.name.first} ${user.name.last}`,
          clientPhone: user.phone,
        },
      },
      line_items: [
        {
          price_data: {
            currency: "gbp",
            product_data: { name: serviceDoc.name, description: `Booking ID: ${booking._id}` },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      adaptive_pricing: { enabled: false },
      success_url: `${process.env.FRONTEND_URL}/paymentsuccess?session_id={CHECKOUT_SESSION_ID}&address=${checkaddress}&userId=${user._id}&PostalCode=${PostalCode}`,
      cancel_url: `${process.env.FRONTEND_URL}/paymentfailed`,
      metadata: {
        bookingId: booking._id.toString(),
        serviceName: serviceDoc.name,
      },
    });

    // ✅ Create payment record
    await Payment.create({
      bookingId: booking._id,
      userId: booking.clientId,
      provider: "stripe",
      amount: finalPrice,
      status: "pending",
      method: "null",
    });

    return res.json({ url: session.url });

  } catch (error) {
    console.error("Booking creation failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = createBooking;
