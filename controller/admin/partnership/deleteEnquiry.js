const PartnershipEnquiry = require("../../../models/PartnershipEnquirySchema");

const deleteEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const enquiry = await PartnershipEnquiry.findByIdAndDelete(id);
    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }
    return res.json({ message: "Enquiry deleted" });
  } catch (err) {
    console.error("deleteEnquiry error:", err);
    return res.status(500).json({ message: "Failed to delete enquiry" });
  }
};

module.exports = deleteEnquiry;
