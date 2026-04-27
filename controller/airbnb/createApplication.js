const AirbnbHostApplication = require("../../models/AirbnbHostApplicationSchema");

const createApplication = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      propertyName,
      airbnbListingUrl,
      propertyAddress,
      city,
      postcode,
      propertyType,
      bedrooms,
      accessInstructions,
      estimatedMonthlyBookings,
      massageServicesInterested,
      adequateSpaceForTable,
      preferredPaymentArrangement,
      heardAboutUs,
      additionalNotes,
    } = req.body;

    if (
      !firstName ||
      !lastName ||
      !email ||
      !phone ||
      !propertyName ||
      !propertyAddress ||
      !city ||
      !postcode ||
      !propertyType ||
      !accessInstructions ||
      !adequateSpaceForTable ||
      !preferredPaymentArrangement
    ) {
      return res
        .status(400)
        .json({ message: "Please fill in all required fields." });
    }

    const application = await AirbnbHostApplication.create({
      firstName,
      lastName,
      email,
      phone,
      propertyName,
      airbnbListingUrl,
      propertyAddress,
      city,
      postcode,
      propertyType,
      bedrooms: bedrooms ? Number(bedrooms) : null,
      accessInstructions,
      estimatedMonthlyBookings,
      massageServicesInterested: Array.isArray(massageServicesInterested)
        ? massageServicesInterested
        : [],
      adequateSpaceForTable,
      preferredPaymentArrangement,
      heardAboutUs,
      additionalNotes,
    });

    return res
      .status(201)
      .json({ message: "Application submitted successfully", application });
  } catch (err) {
    console.error("createAirbnbHostApplication error:", err);
    return res.status(500).json({ message: "Failed to submit application" });
  }
};

module.exports = createApplication;
