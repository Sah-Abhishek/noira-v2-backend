const PartnershipEnquiry = require("../../../models/PartnershipEnquirySchema");

const updateEnquiry = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["new", "contacted", "closed"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const enquiry = await PartnershipEnquiry.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!enquiry) {
      return res.status(404).json({ message: "Enquiry not found" });
    }

    return res.json({ message: "Status updated", enquiry });
  } catch (err) {
    console.error("updateEnquiry error:", err);
    return res.status(500).json({ message: "Failed to update enquiry" });
  }
};

module.exports = updateEnquiry;
