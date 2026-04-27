const mongoose = require("mongoose");
const { Schema } = mongoose;

const PartnershipEnquirySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    business: { type: String, default: "", trim: true },
    instagram: { type: String, default: "", trim: true },
    tiktok: { type: String, default: "", trim: true },
    type: {
      type: String,
      required: true,
      enum: [
        "Hotel & Hospitality",
        "Corporate Wellness",
        "Supplier Partnership",
        "Influencer Collaboration",
      ],
    },
    message: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PartnershipEnquiry", PartnershipEnquirySchema);
