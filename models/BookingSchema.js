const mongoose = require("mongoose");
const { Schema } = mongoose;
const Counter = require('./CounterSchema')
/* ------------------ BOOKINGS ------------------ */
const BookingSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  therapistId: { type: Schema.Types.ObjectId, ref: "TherapistProfile", required: true },
  serviceId: { type: Schema.Types.ObjectId, ref: "Service", required: true },
  ritualPurchaseId: { type: Schema.Types.ObjectId, ref: "RitualPurchase", required: false } || { type: String },
  date: { type: Date, required: true }, // if from bundle
  slotStart: { type: Date, required: true },
  slotEnd:  { type: Date, required: true },
  status: { type: String, enum: ["confirmed", "cancelled", "completed","pending","declined"], default: "pending" },
  paymentIntentId: String,
  paymentStatus: { type: String, enum: ["pending", "paid", "failed"], default: "pending" },
  customerEmail: String,
  price: { amount: Number},
  eliteHourSurcharge: { type: Boolean, default: false },
  notes: String,
  isReviewed: { type: Boolean, default: false },
  receipt_url: { type: String },
  paymentMode:String,
  couponId: { type: Schema.Types.ObjectId, ref: "Coupon", default: null },
  couponCode: { type: String, default: null },
  discountAmount: { type: Number, default: 0 },
  review: { 
    type: {
      rating: { type: Number, min: 1, max: 5 },
      Comment: String,
      reply:String,
    },
    default: null,
  },
 
settlementId: { 
    type: Schema.Types.ObjectId, 
    ref: "TherapistSettlement", 
    default: null 
} // Null until it is included in a formal settlement.
}, { timestamps: true } );


module.exports = mongoose.model("Booking", BookingSchema);
