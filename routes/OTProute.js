
const express = require("express");
const { sendOtp, verifyOtp } = require("../services/otpservice");
const router = express.Router();

// Send custom OTP
router.post("/send-otp", async (req, res) => {

  const { mobileNumber} = req.body;
  const user = req.user;
  const purpose = "phoneverification"
  if (!mobileNumber ) {
    return res.status(400).json({ success: false, message: "Mobile number, userId, and purpose are required" });
  }

  try {
    // The sendOtp function now generates and saves the OTP before sending
    const result = await sendOtp(mobileNumber, user._id, purpose);
    return res.status(result.type === "success" ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Verify custom OTP
router.post("/verify-otp", async (req, res) => {
  const { mobileNumber, otp } = req.body;
  const user = req.user;
  if (!mobileNumber ) {
    return res.status(400).json({ success: false, message: "Mobile number, OTP, and userId are required" });
  }
  try {
    const result = await verifyOtp(mobileNumber, otp, user._id);
    
    return res.status(result.type === "success" ? 200 : 400).json(result);
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
