const Coupon = require("../../../models/CouponSchema");

const createCoupon = async (req, res) => {
  try {
    const { code, type, value, maxUses, expiryDate, minOrderAmount, description } = req.body;

    if (!code || !type) {
      return res.status(400).json({ message: "Code and type are required" });
    }

    if (type === "percentage" && (value <= 0 || value > 100)) {
      return res.status(400).json({ message: "Percentage value must be between 1 and 100" });
    }

    if (type === "fixed" && value <= 0) {
      return res.status(400).json({ message: "Fixed discount value must be greater than 0" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (existing) {
      return res.status(409).json({ message: "Coupon code already exists" });
    }

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      type,
      value: type === "free" ? 0 : value,
      maxUses: maxUses || 0,
      expiryDate: expiryDate || null,
      minOrderAmount: minOrderAmount || 0,
      description: description || "",
    });

    return res.status(201).json({ message: "Coupon created", coupon });
  } catch (error) {
    console.error("Create coupon failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = createCoupon;
