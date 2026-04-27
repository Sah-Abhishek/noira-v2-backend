const AirbnbHostApplication = require("../../../models/AirbnbHostApplicationSchema");

const ALLOWED_STATUSES = ["new", "contacted", "approved", "rejected", "closed"];

const updateApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const application = await AirbnbHostApplication.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    return res.json({ message: "Status updated", application });
  } catch (err) {
    console.error("updateAirbnbApplication error:", err);
    return res.status(500).json({ message: "Failed to update application" });
  }
};

module.exports = updateApplication;
