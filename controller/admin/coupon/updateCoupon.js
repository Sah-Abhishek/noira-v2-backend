const Coupon = require("../../../models/CouponSchema");

const updateCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, type, value, maxUses, expiryDate, isActive, minOrderAmount, description } = req.body;

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    if (code && code.toUpperCase().trim() !== coupon.code) {
      const existing = await Coupon.findOne({ code: code.toUpperCase().trim() });
      if (existing) {
        return res.status(409).json({ message: "Coupon code already exists" });
      }
      coupon.code = code.toUpperCase().trim();
    }

    if (type !== undefined) coupon.type = type;
    if (value !== undefined) coupon.value = value;
    if (maxUses !== undefined) coupon.maxUses = maxUses;
    if (expiryDate !== undefined) coupon.expiryDate = expiryDate;
    if (isActive !== undefined) coupon.isActive = isActive;
    if (minOrderAmount !== undefined) coupon.minOrderAmount = minOrderAmount;
    if (description !== undefined) coupon.description = description;

    await coupon.save();

    return res.status(200).json({ message: "Coupon updated", coupon });
  } catch (error) {
    console.error("Update coupon failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = updateCoupon;
