const Coupon = require("../../../models/CouponSchema");

const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;

    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.status(200).json({ message: "Coupon deleted" });
  } catch (error) {
    console.error("Delete coupon failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = deleteCoupon;
