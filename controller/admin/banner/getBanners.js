const Banner = require("../../../models/BannerSchema");

const getBanners = async (req, res) => {
  try {
    const banners = await Banner.find().sort({ priority: -1, createdAt: -1 });
    return res.status(200).json({ banners });
  } catch (error) {
    console.error("Get banners failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = getBanners;
