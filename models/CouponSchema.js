const mongoose = require("mongoose");
const { Schema } = mongoose;

const CouponSchema = new Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["percentage", "fixed", "free"],
    required: true,
  },
  value: {
    type: Number,
    default: 0, // percentage (1-100) or fixed amount in GBP; ignored for "free"
  },
  maxUses: {
    type: Number,
    default: 0, // 0 = unlimited
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  expiryDate: {
    type: Date,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  minOrderAmount: {
    type: Number,
    default: 0,
  },
  description: {
    type: String,
    default: "",
  },
}, { timestamps: true });

module.exports = mongoose.model("Coupon", CouponSchema);
