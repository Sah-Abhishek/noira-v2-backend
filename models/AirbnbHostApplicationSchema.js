const mongoose = require("mongoose");
const { Schema } = mongoose;

const AirbnbHostApplicationSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },

    propertyName: { type: String, required: true, trim: true },
    airbnbListingUrl: { type: String, default: "", trim: true },
    propertyAddress: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    postcode: { type: String, required: true, trim: true },
    propertyType: { type: String, required: true, trim: true },
    bedrooms: { type: Number, default: null },
    accessInstructions: { type: String, required: true, trim: true },

    estimatedMonthlyBookings: { type: String, default: "", trim: true },
    massageServicesInterested: { type: [String], default: [] },
    adequateSpaceForTable: { type: String, default: "", trim: true },
    preferredPaymentArrangement: { type: String, default: "", trim: true },

    heardAboutUs: { type: String, default: "", trim: true },
    additionalNotes: { type: String, default: "", trim: true },

    status: {
      type: String,
      enum: ["new", "contacted", "approved", "rejected", "closed"],
      default: "new",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "AirbnbHostApplication",
  AirbnbHostApplicationSchema
);
