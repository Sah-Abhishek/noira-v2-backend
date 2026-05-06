const express = require("express");
const mongoose = require("mongoose");
const TherapistProfiles = require("../../../models/TherapistProfiles");
const AvailabilitySchema = require("../../../models/AvailabilitySchema");
const ServiceSchema = require("../../../models/ServiceSchema");
const BookingSchema = require("../../../models/BookingSchema");

/**
 * @route POST /therapists/filter
 * @desc Get available therapists based on service, date & time
 * @body { service: { serviceId, optionIndex }, date (DD-MM-YYYY), time (HH:mm) }
 */

const getTherapists = async (req, res) => {
  try {
    const { service, date, time, postalCode } = req.body;

    if (
      !service?.serviceId ||
      service.optionIndex === undefined ||
      !date ||
      !time ||
      !postalCode
    ) {
      return res.status(400).json({ error: "Invalid request body" });
    }

  const normalizedPostalCode = String(postalCode).trim().toUpperCase();
    const outwardCode = normalizedPostalCode.split(" ")[0]; // Only first part (outcode)
    // Build candidates so therapists registered at area level ("W1")
    // still match users whose postcode has a more specific outcode ("W1A").
    const postcodeCandidates = [outwardCode];
    const areaCode = outwardCode.replace(/[A-Z]$/, "");
    if (areaCode !== outwardCode && areaCode.length >= 2) {
      postcodeCandidates.push(areaCode);
    }
    // Also accept therapists registered under the bare area letters
    // (e.g. "HA" matching "HA8 5AB"). Restrict to >=2 letters so single-letter
    // prefixes like "W" or "N" don't over-match.
    const letterPrefix = outwardCode.match(/^[A-Z]+/)?.[0];
    if (
      letterPrefix &&
      letterPrefix.length >= 2 &&
      !postcodeCandidates.includes(letterPrefix)
    ) {
      postcodeCandidates.push(letterPrefix);
    }
    console.log("[TherapistFilter] postcode:", { outwardCode, postcodeCandidates });

    // Parse date & time (your code already handles this)
    const [year, month, day] = date.split("-");
    const slotStart = new Date(`${year}-${month}-${day}T${time}:00.000Z`);

    if (isNaN(slotStart.getTime())) {
      return res.status(400).json({ error: "Invalid date or time format" });
    }

    // ✅ Past date check
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (slotStart < today) {
      return res
        .status(400)
        .json({ error: "Selected date cannot be in the past" });
    }

    // Convert service ID to ObjectId
    const serviceID = new mongoose.Types.ObjectId(service.serviceId);

    // Get service duration
    const serviceDoc = await ServiceSchema.findById(serviceID);
    if (!serviceDoc)
      return res.status(404).json({ error: "Service not found" });

    const option = serviceDoc.options[service.optionIndex];
    if (!option)
      return res.status(400).json({ error: "Invalid option index" });

    const slotEnd = new Date(
      slotStart.getTime() + option.durationMinutes * 60000
    );

    // ✅ Step 1: Find therapists offering this service **and matching postal code**
    // Empty `specializations` is treated as "no service restriction" so newly
    // created therapists (who haven't picked specific services yet) can still
    // be booked. The schema marks each specialization as required: false.
    const therapists = await TherapistProfiles.find({
      $or: [
        { specializations: serviceID },
        { specializations: { $size: 0 } },
      ],
      active: true,
      servicesInPostalCodes: { $in: postcodeCandidates }, // 🔑 prefix-aware match
    })
      .populate("userId", "email avatar_url")
      .populate("specializations", "name");

    console.log("[TherapistFilter] stage1 matched therapists:", therapists.length, therapists.map(t => ({ id: t._id.toString(), specs: t.specializations.length })));

    if (!therapists.length) {
      return res.status(200).json({ therapists: [] });
    }

    const therapistIds = therapists.map((t) => t._id);

    const dayStart = new Date(slotStart);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(slotStart);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // ✅ Step 2: Get therapist availabilities for that day
    const availabilities = await AvailabilitySchema.find({
      therapistId: { $in: therapistIds },
      date: { $gte: dayStart, $lte: dayEnd },
    });
    console.log("[TherapistFilter] availability rows for that day:", availabilities.length);

    // ✅ Step 3: Filter therapists based on available blocks
    const availableTherapistIds = availabilities
      .filter((av) =>
        av.blocks.some((block) => {
          if (!block.isAvailable) return false;

          const [bh, bm] = block.startTime.split(":").map(Number);
          const [eh, em] = block.endTime.split(":").map(Number);

          const blockStart = new Date(av.date);
          blockStart.setUTCHours(bh, bm, 0, 0);

          const blockEnd = new Date(av.date);
          blockEnd.setUTCHours(eh, em, 0, 0);

          return slotStart >= blockStart && slotEnd <= blockEnd;
        })
      )
      .map((av) => av.therapistId.toString());

    if (!availableTherapistIds.length) {
      return res.json({ therapists: [] });
    }

    // ✅ Step 4: Exclude therapists with conflicting bookings
    const conflictingBookings = await BookingSchema.find({
      therapistId: { $in: availableTherapistIds },
      date: new Date(`${year}-${month}-${day}T00:00:00.000Z`),
      $or: [
        {
          slotStart: { $lt: slotEnd },
          slotEnd: { $gt: slotStart },
        },
      ],
    });

    const bookedTherapistIds = conflictingBookings.map((b) =>
      b.therapistId.toString()
    );

    // ✅ Final filtered list
    const finalTherapists = therapists.filter(
      (t) =>
        availableTherapistIds.includes(t._id.toString()) &&
        !bookedTherapistIds.includes(t._id.toString())
    );

    console.log("[TherapistFilter] result:", {
      stage1: therapists.length,
      withBlock: availableTherapistIds.length,
      booked: bookedTherapistIds.length,
      final: finalTherapists.length,
    });

    return res.json({
      therapists: finalTherapists,
    });
  } catch (error) {
    console.error("Error filtering therapists:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
module.exports = getTherapists
