const Banner = require("../../models/BannerSchema");

const getActiveBanners = async (req, res) => {
  try {
    const { page } = req.query;

    const now = new Date();

    const query = {
      isActive: true,
      // Only include banners whose schedule is currently valid
      $or: [
        { startDate: null, endDate: null },
        { startDate: null, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: null },
        { startDate: { $lte: now }, endDate: { $gte: now } },
      ],
    };

    // If a specific page is requested, filter by it
    if (page) {
      query.pages = page;
    }

    const banners = await Banner.find(query).sort({ priority: -1, createdAt: -1 });

    return res.status(200).json({ banners });
  } catch (error) {
    console.error("Get active banners failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = getActiveBanners;
