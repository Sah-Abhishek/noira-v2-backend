const PartnershipEnquiry = require("../../../models/PartnershipEnquirySchema");

const getEnquiries = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const enquiries = await PartnershipEnquiry.find(filter).sort({
      createdAt: -1,
    });
    return res.json({ enquiries });
  } catch (err) {
    console.error("getEnquiries error:", err);
    return res.status(500).json({ message: "Failed to fetch enquiries" });
  }
};

module.exports = getEnquiries;
