const TherapistAvailability = require("../../../models/AvailabilitySchema.js");

/**
 * Add or update therapist availability for a specific date
 */

const addAvailability = async (req, res) => {
  try {
    const { therapistId, date, blocks } = req.body;

    if (!therapistId || !date || !blocks || !Array.isArray(blocks)) {
      return res.status(400).json({ error: "therapistId, date, and blocks are required" });
    }

    const normalizedDate = new Date(date);
    normalizedDate.setUTCHours(0, 0, 0, 0);

    let availability = await TherapistAvailability.findOne({ therapistId, date: normalizedDate });
    if (!availability) {
      availability = new TherapistAvailability({
        therapistId,
        date: normalizedDate,
        blocks: []
      });
    }

    const toMinutes = (time) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };

    const validBlocks = [];
    const skippedInvalid = [];
    const skippedConflicts = [];

    // Sort incoming blocks by startTime for easier conflict checks
    const sortedBlocks = blocks.sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

    for (let i = 0; i < sortedBlocks.length; i++) {
      const block = sortedBlocks[i];
      const start = toMinutes(block.startTime);
      const end = toMinutes(block.endTime);

      // Allow end up to 24*60 = 1440 (24:00 = end of day, covers 23:30 slot).
      if (end <= start || end > 1440) {
        skippedInvalid.push(block);
        continue;
      }

      // Check if this block overlaps with any already accepted block
      const isConflict = validBlocks.some((b) => {
        const bStart = toMinutes(b.startTime);
        const bEnd = toMinutes(b.endTime);
        return start < bEnd && end > bStart;
      });

      if (isConflict) {
        skippedConflicts.push(block);
        continue;
      }

      validBlocks.push(block);
    }

    // ✅ Replace old blocks with new valid ones
    availability.blocks = validBlocks;
    await availability.save();

    return res.status(200).json({
      message: "Availability updated successfully",
      updatedBlocks: validBlocks,
      skippedInvalid,
      skippedConflicts,
      availability
    });
  } catch (error) {
    console.error("Error updating availability:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = addAvailability;
