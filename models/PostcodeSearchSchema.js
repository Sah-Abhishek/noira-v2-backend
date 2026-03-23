const mongoose = require("mongoose");

const PostcodeSearchSchema = new mongoose.Schema(
  {
    postcode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    outcode: {
      type: String,
      uppercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

PostcodeSearchSchema.index({ outcode: 1 });
PostcodeSearchSchema.index({ createdAt: 1 });

module.exports = mongoose.model("PostcodeSearch", PostcodeSearchSchema);
