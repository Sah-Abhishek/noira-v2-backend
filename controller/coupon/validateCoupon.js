const Coupon = require("../../models/CouponSchema");

const validateCoupon = async (req, res) => {
  try {
    const { code, amount } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required" });
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase().trim() });

    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code" });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ message: "This coupon is no longer active" });
    }

    if (coupon.expiryDate && new Date() > coupon.expiryDate) {
      return res.status(400).json({ message: "This coupon has expired" });
    }

    if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) {
      return res.status(400).json({ message: "This coupon has reached its usage limit" });
    }

    if (amount && coupon.minOrderAmount > 0 && amount < coupon.minOrderAmount) {
      return res.status(400).json({
        message: `Minimum order amount for this coupon is £${coupon.minOrderAmount}`,
      });
    }

    let discount = 0;
    if (amount) {
      if (coupon.type === "percentage") {
        discount = Math.round((amount * coupon.value) / 100 * 100) / 100;
      } else if (coupon.type === "fixed") {
        discount = Math.min(coupon.value, amount);
      } else if (coupon.type === "free") {
        discount = amount;
      }
    }

    return res.status(200).json({
      message: "Coupon is valid",
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        discount,
        finalAmount: amount ? Math.max(0, amount - discount) : undefined,
      },
    });
  } catch (error) {
    console.error("Validate coupon failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = validateCoupon;
