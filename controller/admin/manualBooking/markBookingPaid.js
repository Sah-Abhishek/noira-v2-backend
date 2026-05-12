const Booking = require("../../../models/BookingSchema");
const Payment = require("../../../models/PaymentSchema");

/**
 * POST /api/admin/booking/:id/mark-paid
 *
 * Admin manually marks a pending card-link (or cash) booking as paid once
 * they've confirmed the customer completed payment (Stripe webhook also
 * does this automatically; this endpoint is the manual fallback for cash
 * paid in person, bank transfer, etc.).
 */
const markBookingPaid = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.status === "cancelled") {
      return res.status(400).json({ message: "Booking is cancelled" });
    }
    if (booking.paymentStatus === "paid") {
      return res.status(400).json({ message: "Booking is already marked paid" });
    }

    booking.paymentStatus = "paid";
    if (booking.status !== "completed") {
      booking.status = "confirmed";
    }
    await booking.save();

    await Payment.findOneAndUpdate(
      { bookingId: booking._id },
      { paymentStatus: "paid", status: "paid" },
      { upsert: true }
    );

    return res.json({
      message: "Booking marked as paid",
      booking: {
        _id: booking._id,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
      },
    });
  } catch (err) {
    console.error("markBookingPaid failed:", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};

module.exports = markBookingPaid;