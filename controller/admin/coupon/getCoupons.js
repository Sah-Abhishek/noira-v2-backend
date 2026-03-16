const Coupon = require("../../../models/CouponSchema");

const getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    return res.status(200).json({ coupons });
  } catch (error) {
    console.error("Get coupons failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = getCoupons;
