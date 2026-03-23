const PostcodeSearch = require("../../models/PostcodeSearchSchema");

const logPostcodeSearch = async (req, res) => {
  try {
    const { postcode } = req.body;

    if (!postcode || typeof postcode !== "string") {
      return res.status(400).json({ error: "Postcode is required" });
    }

    const normalized = postcode.trim().toUpperCase();
    // Extract outcode (first part before space, or everything except last 3 chars)
    const parts = normalized.split(" ");
    const outcode =
      parts.length > 1 ? parts[0] : normalized.slice(0, -3) || normalized;

    await PostcodeSearch.create({ postcode: normalized, outcode });

    return res.status(201).json({ message: "Logged" });
  } catch (error) {
    console.error("Error logging postcode search:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = logPostcodeSearch;
