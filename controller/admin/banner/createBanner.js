const Banner = require("../../../models/BannerSchema");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 100000,
});

const createBanner = async (req, res) => {
  try {
    const { title, description, linkUrl, pages, position, startDate, endDate, priority } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    let parsedPages = pages;
    if (typeof pages === "string") {
      try {
        parsedPages = JSON.parse(pages);
      } catch {
        parsedPages = [pages];
      }
    }

    if (!parsedPages || parsedPages.length === 0) {
      return res.status(400).json({ message: "At least one page must be selected" });
    }

    if (!req.files || !req.files.image) {
      return res.status(400).json({ message: "Banner image is required" });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.files.image.tempFilePath, {
      folder: "banners",
    });

    const banner = await Banner.create({
      title,
      description: description || "",
      imageUrl: result.secure_url,
      linkUrl: linkUrl || "",
      pages: parsedPages,
      position: position || "top",
      isActive: true,
      startDate: startDate || null,
      endDate: endDate || null,
      priority: priority ? Number(priority) : 0,
    });

    return res.status(201).json({ message: "Banner created", banner });
  } catch (error) {
    console.error("Create banner failed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = createBanner;
