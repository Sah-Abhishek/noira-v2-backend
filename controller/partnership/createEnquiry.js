const PartnershipEnquiry = require("../../models/PartnershipEnquirySchema");

const createEnquiry = async (req, res) => {
  try {
    const { name, email, business, instagram, tiktok, type, message } =
      req.body;

    if (!name || !email || !type) {
      return res
        .status(400)
        .json({ message: "Name, email, and partnership type are required." });
    }

    const enquiry = await PartnershipEnquiry.create({
      name,
      email,
      business,
      instagram,
      tiktok,
      type,
      message,
    });

    return res
      .status(201)
      .json({ message: "Enquiry submitted successfully", enquiry });
  } catch (err) {
    console.error("createEnquiry error:", err);
    return res.status(500).json({ message: "Failed to submit enquiry" });
  }
};

module.exports = createEnquiry;
