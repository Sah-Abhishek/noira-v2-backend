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
    // console.log("[TherapistFilter] postcode:", { outwardCode, postcodeCandidates });

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

    // console.log("[TherapistFilter] stage1 matched therapists:", therapists.length, therapists.map(t => ({ id: t._id.toString(), specs: t.specializations.length })));

    if (!therapists.length) {
      return res.status(200).json({ therapists: [] });
    }

    const therapistIds = therapists.map((t) => t._id);

    // Days the slot touches. If the booking ends past midnight (e.g. 23:00 +
    // 150min ends at 01:30 next day) we need both days' availability docs.
    const dayStart = new Date(slotStart);
    dayStart.setUTCHours(0, 0, 0, 0);
    const slotEndDay = new Date(slotEnd.getTime() - 1); // -1ms so an end at exactly 00:00 belongs to the prior day
    slotEndDay.setUTCHours(0, 0, 0, 0);
    const isOvernight = slotEndDay.getTime() > dayStart.getTime();
    const relevantDays = isOvernight ? [dayStart, slotEndDay] : [dayStart];

    // ✅ Step 2: Get therapist availabilities for relevant day(s)
    const availabilities = await AvailabilitySchema.find({
      therapistId: { $in: therapistIds },
      date: { $in: relevantDays },
    });
    // console.log(
    //   "[TherapistFilter] availability rows:",
    //   availabilities.length,
    //   "isOvernight:",
    //   isOvernight
    // );

    // Group by therapist so we can merge intervals across days.
    const blocksByTherapist = new Map();
    for (const av of availabilities) {
      const key = av.therapistId.toString();
      if (!blocksByTherapist.has(key)) blocksByTherapist.set(key, []);
      for (const block of av.blocks) {
        if (!block.isAvailable) continue;
        const [bh, bm] = block.startTime.split(":").map(Number);
        const [eh, em] = block.endTime.split(":").map(Number);
        const start = new Date(av.date);
        start.setUTCHours(bh, bm, 0, 0);
        const end = new Date(av.date);
        end.setUTCHours(eh, em, 0, 0); // setUTCHours(24,...) rolls into next day
        blocksByTherapist.get(key).push({ start, end });
      }
    }

    // ✅ Step 3: For each therapist, merge contiguous available intervals and
    // check whether any merged interval fully contains the slot.
    const availableTherapistIds = [];
    for (const [tid, intervals] of blocksByTherapist.entries()) {
      intervals.sort((a, b) => a.start - b.start);
      const merged = [];
      for (const iv of intervals) {
        const last = merged[merged.length - 1];
        if (last && iv.start.getTime() <= last.end.getTime()) {
          if (iv.end.getTime() > last.end.getTime()) last.end = iv.end;
        } else {
          merged.push({ start: iv.start, end: iv.end });
        }
      }
      const fits = merged.some(
        (m) => slotStart >= m.start && slotEnd <= m.end
      );
      if (fits) availableTherapistIds.push(tid);
    }

    if (!availableTherapistIds.length) {
      return res.json({ therapists: [] });
    }

    // ✅ Step 4: Exclude therapists with conflicting bookings on EITHER day.
    const conflictingBookings = await BookingSchema.find({
      therapistId: { $in: availableTherapistIds },
      date: { $in: relevantDays },
      status: { $in: ["confirmed", "pending"] },
      slotStart: { $lt: slotEnd },
      slotEnd: { $gt: slotStart },
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

    // console.log("[TherapistFilter] result:", {
    //   stage1: therapists.length,
    //   withBlock: availableTherapistIds.length,
    //   booked: bookedTherapistIds.length,
    //   final: finalTherapists.length,
    // });

    return res.json({
      therapists: finalTherapists,
    });
  } catch (error) {
    console.error("Error filtering therapists:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
module.exports = getTherapists
