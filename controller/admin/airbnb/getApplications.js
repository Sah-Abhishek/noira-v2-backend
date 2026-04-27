const AirbnbHostApplication = require("../../../models/AirbnbHostApplicationSchema");

const getApplications = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const applications = await AirbnbHostApplication.find(filter).sort({
      createdAt: -1,
    });
    return res.json({ applications });
  } catch (err) {
    console.error("getAirbnbApplications error:", err);
    return res.status(500).json({ message: "Failed to fetch applications" });
  }
};

module.exports = getApplications;
