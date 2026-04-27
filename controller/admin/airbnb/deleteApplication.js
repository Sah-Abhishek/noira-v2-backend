const AirbnbHostApplication = require("../../../models/AirbnbHostApplicationSchema");

const deleteApplication = async (req, res) => {
  try {
    const { id } = req.params;
    const application = await AirbnbHostApplication.findByIdAndDelete(id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }
    return res.json({ message: "Application deleted" });
  } catch (err) {
    console.error("deleteAirbnbApplication error:", err);
    return res.status(500).json({ message: "Failed to delete application" });
  }
};

module.exports = deleteApplication;
