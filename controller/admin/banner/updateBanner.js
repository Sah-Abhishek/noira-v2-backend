const Banner = require("../../../models/BannerSchema");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 100000,
});

const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, linkUrl, pages, position, isActive, startDate, endDate, priority } = req.body;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({ message: "Banner not found" });
    }

    if (title !== undefined) banner.title = title;
    if (description !== undefined) banner.description = description;
    if (linkUrl !== undefined) banner.linkUrl = linkUrl;
    if (position !== undefined) banner.position = position;
    if (isActive !== undefined) banner.isActive = isActive === "true" || isActive === true;
    if (startDate !== undefined) banner.startDate = startDate || null;
    if (endDate !== undefined) banner.endDate = endDate || null;
    if (priority !== undefined) banner.priority = Number(priority);

    if (pages !== undefined) {
      let parsedPages = pages;
      if (typeof pages === "string") {
        try {
          parsedPages = JSON.parse(pages);
        } catch {
          parsedPages = [pages];
        }
      }
      banner.pages = parsedPages;
    }

    // If a new image is uploaded, replace it
    if (req.files && req.files.image) {
      const result = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
        folder: "banners",
      });
      banner.imageUrl = result.secure_url;
    }

    await banner.save();

    return res.status(200).json({ message: "Banner updated", banner });
  } catch (error) {
    console.error("Update banner failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = updateBanner;
