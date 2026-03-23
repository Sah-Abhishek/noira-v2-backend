const Booking = require("../../../models/BookingSchema");
const Coupon = require("../../../models/CouponSchema");

const couponAnalytics = async (req, res) => {
  try {
    // 1. All coupons for reference
    const coupons = await Coupon.find().lean();

    // 2. Aggregate bookings that used a coupon
    const bookingStats = await Booking.aggregate([
      { $match: { couponCode: { $ne: null } } },
      {
        $group: {
          _id: "$couponCode",
          couponId: { $first: "$couponId" },
          totalBookings: { $sum: 1 },
          totalDiscount: { $sum: "$discountAmount" },
          totalRevenue: { $sum: "$price.amount" },
          lastUsedAt: { $max: "$createdAt" },
        },
      },
      { $sort: { totalBookings: -1 } },
    ]);

    // Merge coupon details into stats
    const couponMap = {};
    coupons.forEach((c) => {
      couponMap[c.code] = c;
    });

    const perCoupon = bookingStats.map((stat) => {
      const coupon = couponMap[stat._id] || {};
      return {
        code: stat._id,
        couponId: stat.couponId,
        type: coupon.type || "unknown",
        value: coupon.value || 0,
        isActive: coupon.isActive ?? false,
        totalBookings: stat.totalBookings,
        totalDiscount: Math.round(stat.totalDiscount * 100) / 100,
        totalRevenue: Math.round(stat.totalRevenue * 100) / 100,
        lastUsedAt: stat.lastUsedAt,
        usedCount: coupon.usedCount || 0,
        maxUses: coupon.maxUses || 0,
      };
    });

    // 3. Overall summary
    const totalDiscountedBookings = perCoupon.reduce((s, c) => s + c.totalBookings, 0);
    const totalDiscountGiven = perCoupon.reduce((s, c) => s + c.totalDiscount, 0);
    const totalRevenueWithCoupons = perCoupon.reduce((s, c) => s + c.totalRevenue, 0);
    const avgDiscount = totalDiscountedBookings > 0
      ? Math.round((totalDiscountGiven / totalDiscountedBookings) * 100) / 100
      : 0;
    const mostUsedCoupon = perCoupon.length > 0 ? perCoupon[0].code : "N/A";

    // 4. Recent bookings that used coupons (last 20)
    const recentCouponBookings = await Booking.find({ couponCode: { $ne: null } })
      .populate("clientId", "name email")
      .populate("serviceId", "name")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const recentBookings = recentCouponBookings.map((b) => ({
      bookingId: b._id,
      clientName: b.clientId
        ? `${b.clientId.name?.first || ""} ${b.clientId.name?.last || ""}`.trim()
        : "Unknown",
      clientEmail: b.clientId?.email || "",
      service: b.serviceId?.name || "N/A",
      couponCode: b.couponCode,
      discountAmount: b.discountAmount,
      finalPrice: b.price?.amount || 0,
      paymentMode: b.paymentMode,
      status: b.status,
      createdAt: b.createdAt,
    }));

    res.json({
      success: true,
      summary: {
        totalDiscountedBookings,
        totalDiscountGiven: Math.round(totalDiscountGiven * 100) / 100,
        totalRevenueWithCoupons: Math.round(totalRevenueWithCoupons * 100) / 100,
        avgDiscount,
        mostUsedCoupon,
        totalCoupons: coupons.length,
        activeCoupons: coupons.filter((c) => c.isActive).length,
      },
      perCoupon,
      recentBookings,
    });
  } catch (error) {
    console.error("Coupon analytics error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = couponAnalytics;
