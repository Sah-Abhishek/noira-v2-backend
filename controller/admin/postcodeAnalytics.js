const PostcodeSearch = require("../../models/PostcodeSearchSchema");

const getPostcodeAnalytics = async (req, res) => {
  try {
    const { period = "all", limit = 20 } = req.query;

    let matchStage = {};
    const now = new Date();

    if (period === "today") {
      const start = new Date(now);
      start.setUTCHours(0, 0, 0, 0);
      matchStage = { createdAt: { $gte: start } };
    } else if (period === "week") {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      matchStage = { createdAt: { $gte: start } };
    } else if (period === "month") {
      const start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      matchStage = { createdAt: { $gte: start } };
    }

    // Top postcodes by full postcode
    const topPostcodes = await PostcodeSearch.aggregate([
      { $match: matchStage },
      { $group: { _id: "$postcode", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) },
      { $project: { postcode: "$_id", count: 1, _id: 0 } },
    ]);

    // Top outcodes (area-level)
    const topOutcodes = await PostcodeSearch.aggregate([
      { $match: matchStage },
      { $group: { _id: "$outcode", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: parseInt(limit) },
      { $project: { outcode: "$_id", count: 1, _id: 0 } },
    ]);

    // Total searches count
    const totalSearches = await PostcodeSearch.countDocuments(matchStage);

    return res.json({
      topPostcodes,
      topOutcodes,
      totalSearches,
    });
  } catch (error) {
    console.error("Error fetching postcode analytics:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = getPostcodeAnalytics;
