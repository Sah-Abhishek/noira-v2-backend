const mongoose = require("mongoose");
const { Schema } = mongoose;

const BannerSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      required: true,
    },
    linkUrl: {
      type: String,
      default: "",
    },
    pages: {
      type: [String],
      required: true,
      // Valid page identifiers where this banner can appear
      enum: [
        "home",
        "services",
        "all-services",
        "about",
        "blog",
        "booking",
        "careers",
        "browse-therapists",
      ],
    },
    position: {
      type: String,
      enum: ["top", "middle", "bottom"],
      default: "top",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    priority: {
      type: Number,
      default: 0, // higher = shown first
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Banner", BannerSchema);
