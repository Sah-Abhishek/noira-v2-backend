const User = require("../../../models/userSchema");

/**
 * GET /api/admin/customers/search?phone=<digits>
 * Returns up to 10 client users whose phone matches the digits provided.
 * Used by the Manual Booking form so admin can attach a booking to an
 * existing customer instead of always creating a new one.
 */
const searchCustomer = async (req, res) => {
  try {
    const phoneRaw = String(req.query.phone || "").trim();
    if (!phoneRaw) {
      return res.status(400).json({ message: "phone query is required" });
    }
    // Strip everything except digits — we store with country prefix (e.g. 447...)
    // but the admin may type with spaces, leading 0, +44, etc.
    const digits = phoneRaw.replace(/\D/g, "");
    if (digits.length < 4) {
      return res.json({ customers: [] });
    }

    // Match the trailing portion of the stored phone, so "7466483777"
    // matches "447466483777".
    const tail = digits.slice(-9);
    const safeTail = tail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const customers = await User.find({
      role: "client",
      phone: { $regex: `${safeTail}$` },
    })
      .select("name email phone address")
      .limit(10)
      .lean();

    return res.json({ customers });
  } catch (err) {
    console.error("searchCustomer failed:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = searchCustomer;
