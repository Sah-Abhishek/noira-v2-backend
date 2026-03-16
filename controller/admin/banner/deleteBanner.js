const Banner = require("../../../models/BannerSchema");

const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findByIdAndDelete(id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    return res.status(200).json({ message: "Banner deleted" });
  } catch (error) {
    console.error("Delete banner failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = deleteBanner;
