const TherapistProfile = require("../../../models/TherapistProfiles.js");
const TherapistAvailability = require("../../../models/AvailabilitySchema.js");
const ServiceSchema = require("../../../models/ServiceSchema.js");
const { default: mongoose } = require("mongoose");

const getTherapistById = async (req, res) => {
  try {
    const { id } = req.params;
    const { serviceId, optionIndex } = req.body.cart;

    const userid = new mongoose.Types.ObjectId(id);

    // ✅ Fetch therapist details
    const therapist = await TherapistProfile.findById(userid).populate(
      "userId",
      "name email avatar_url"
    );

    if (!therapist) {
      return res.status(404).json({ error: "Therapist not found" });
    }

    // ✅ Fetch therapist availability
    const availability = await TherapistAvailability.find({
      therapistId: therapist._id,
    });

    let serviceDurationMinutes = 0;

    if (serviceId && optionIndex !== undefined) {
      const serviceDoc = await ServiceSchema.findById(serviceId);
      if (!serviceDoc) {
        return res.status(404).json({ error: "Service not found" });
      }

      const option = serviceDoc.options[optionIndex];
      if (!option) {
        return res.status(400).json({ error: "Invalid option index" });
      }

      serviceDurationMinutes = option.durationMinutes;
    }

    const filteredAvailability = availability.map((day) => {
      const validBlocks = day.blocks
        .filter((block) => block.isAvailable)
        .map((block) => {
          const [startH, startM] = block.startTime.split(":").map(Number);
          const [endH, endM] = block.endTime.split(":").map(Number);

          const blockStart = new Date(day.date);
          blockStart.setUTCHours(startH, startM, 0, 0);

          const blockEnd = new Date(day.date);
          blockEnd.setUTCHours(endH, endM, 0, 0);

          if (serviceDurationMinutes > 0) {
            // ✅ Calculate latest possible start time
            const latestStart = new Date(
              blockEnd.getTime() - serviceDurationMinutes * 60000
            );

            if (latestStart <= blockStart) {
              // Block is too short — remove it entirely
              return null;
            }

            // ✅ Trim block's end time so user can't pick a time that would exceed working hours
            const trimmedEndH = latestStart.getUTCHours();
            const trimmedEndM = latestStart.getUTCMinutes();

            // We add 1 min to allow booking exactly at the latest allowed start time
            const adjustedEnd = new Date(latestStart);
            adjustedEnd.setUTCMinutes(adjustedEnd.getUTCMinutes() + 1);

            block.endTime = `${String(adjustedEnd.getUTCHours()).padStart(
              2,
              "0"
            )}:${String(adjustedEnd.getUTCMinutes()).padStart(2, "0")}`;
          }

          return block;
        })
        .filter(Boolean);

      return {
        ...day.toObject(),
        blocks: validBlocks,
      };
    });

    return res.status(200).json({
      therapist: {
        _id: therapist._id,
        name: therapist.userId?.name,
        email: therapist.userId?.email,
        avatar_url: therapist.userId?.avatar_url,
      },
      availability: filteredAvailability.filter((d) => d.blocks.length > 0),
    });
  } catch (error) {
    console.error("Error fetching therapist by ID:", error.message);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = getTherapistById;
