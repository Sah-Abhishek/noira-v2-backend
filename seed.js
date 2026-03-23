/**
 * Seed script for dev database
 *
 * Usage:
 *   node seed.js          — seeds all data
 *   node seed.js --clean   — drops existing seed data first, then seeds
 *
 * Default credentials:
 *   Admin:     admin@noira.co.uk     / 12345678
 *   Users:     jane@example.com      / User@123
 *              rahul@example.com     / User@123
 *              emma@example.com      / User@123
 *   Therapists: sarah@example.com    / Therapist@123
 *               james@example.com    / Therapist@123
 */

const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");

dotenv.config({ path: "./.env" });

const User = require("./models/userSchema");
const TherapistProfile = require("./models/TherapistProfiles");

const SALT_ROUNDS = 10;
const CLEAN = process.argv.includes("--clean");

// ─── Seed Data ──────────────────────────────────────────

const adminData = {
  name: { first: "Noira", last: "Admin" },
  email: "admin@noira.co.uk",
  password: "12345678",
  role: "admin",
  phone: "447700000001",
  gender: "other",
  emailVerified: true,
  phoneVerified: true,
  profileComplete: true,
};

const usersData = [
  {
    name: { first: "Jane", last: "Cooper" },
    email: "jane@example.com",
    password: "User@123",
    role: "client",
    phone: "447700000010",
    gender: "female",
    emailVerified: true,
    phoneVerified: true,
    profileComplete: true,
    address: {
      Building_No: "12",
      Street: "Baker Street",
      Locality: "Marylebone",
      PostTown: "LONDON",
      PostalCode: "W1U 3BW",
    },
  },
  {
    name: { first: "Rahul", last: "Sharma" },
    email: "rahul@example.com",
    password: "User@123",
    role: "client",
    phone: "447700000020",
    gender: "male",
    emailVerified: true,
    phoneVerified: true,
    profileComplete: true,
    address: {
      Building_No: "45",
      Street: "King's Road",
      Locality: "Chelsea",
      PostTown: "LONDON",
      PostalCode: "SW3 5UR",
    },
  },
  {
    name: { first: "Emma", last: "Williams" },
    email: "emma@example.com",
    password: "User@123",
    role: "client",
    phone: "447700000030",
    gender: "female",
    emailVerified: true,
    phoneVerified: false,
    profileComplete: false,
    address: {
      Building_No: "8",
      Street: "Canary Wharf",
      Locality: "Docklands",
      PostTown: "LONDON",
      PostalCode: "E14 5AB",
    },
  },
];

const therapistsData = [
  {
    user: {
      name: { first: "Sarah", last: "Mitchell" },
      email: "sarah@example.com",
      password: "Therapist@123",
      role: "therapist",
      phone: "447700000100",
      gender: "female",
      emailVerified: true,
      phoneVerified: true,
      profileComplete: true,
      address: {
        Building_No: "22",
        Street: "Harley Street",
        Locality: "Marylebone",
        PostTown: "LONDON",
        PostalCode: "W1G 9PL",
      },
    },
    profile: {
      title: "Senior Massage Therapist",
      bio: "Certified deep tissue and Swedish massage therapist with 8 years of experience in luxury spa settings across London.",
      languages: ["English", "French"],
      servicesInPostalCodes: ["W1", "W2", "SW1", "SW3", "SW7", "NW1"],
      experience: 8,
      rating: 4.8,
      ratingCount: 124,
      isVerified: true,
      active: true,
    },
  },
  {
    user: {
      name: { first: "James", last: "Carter" },
      email: "james@example.com",
      password: "Therapist@123",
      role: "therapist",
      phone: "447700000200",
      gender: "male",
      emailVerified: true,
      phoneVerified: true,
      profileComplete: true,
      address: {
        Building_No: "5",
        Street: "Sloane Street",
        Locality: "Knightsbridge",
        PostTown: "LONDON",
        PostalCode: "SW1X 9LA",
      },
    },
    profile: {
      title: "Sports & Recovery Specialist",
      bio: "Former physiotherapist turned sports massage specialist. I focus on recovery, injury prevention and athletic performance.",
      languages: ["English", "Spanish"],
      servicesInPostalCodes: ["SW1", "SW3", "SW7", "W8", "W11", "E14"],
      experience: 5,
      rating: 4.6,
      ratingCount: 87,
      isVerified: true,
      active: true,
    },
  },
];

// ─── Helpers ────────────────────────────────────────────

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

// ─── Main ───────────────────────────────────────────────

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Optionally clean existing seed data
    if (CLEAN) {
      const seedEmails = [
        adminData.email,
        ...usersData.map((u) => u.email),
        ...therapistsData.map((t) => t.user.email),
      ];
      const existing = await User.find({ email: { $in: seedEmails } });
      const existingIds = existing.map((u) => u._id);

      if (existingIds.length > 0) {
        await TherapistProfile.deleteMany({ userId: { $in: existingIds } });
        await User.deleteMany({ _id: { $in: existingIds } });
        console.log(`Cleaned ${existingIds.length} existing seed user(s)`);
      }
    }

    // ── Admin ──
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log(`Admin already exists: ${adminData.email} (skipped)`);
    } else {
      const adminHash = await hashPassword(adminData.password);
      const admin = await User.create({
        name: adminData.name,
        email: adminData.email,
        passwordHash: adminHash,
        role: adminData.role,
        phone: adminData.phone,
        gender: adminData.gender,
        emailVerified: adminData.emailVerified,
        phoneVerified: adminData.phoneVerified,
        profileComplete: adminData.profileComplete,
      });
      console.log(`Admin created: ${admin.email}`);
    }

    // ── Client Users ──
    for (const userData of usersData) {
      const existing = await User.findOne({ email: userData.email });
      if (existing) {
        console.log(`User already exists: ${userData.email} (skipped)`);
        continue;
      }

      const hash = await hashPassword(userData.password);
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        passwordHash: hash,
        role: userData.role,
        phone: userData.phone,
        gender: userData.gender,
        emailVerified: userData.emailVerified,
        phoneVerified: userData.phoneVerified,
        profileComplete: userData.profileComplete,
        address: userData.address || null,
      });
      console.log(`User created: ${user.email}`);
    }

    // ── Therapists ──
    for (const therapistData of therapistsData) {
      const existing = await User.findOne({ email: therapistData.user.email });
      if (existing) {
        console.log(`Therapist already exists: ${therapistData.user.email} (skipped)`);
        continue;
      }

      const hash = await hashPassword(therapistData.user.password);
      const user = await User.create({
        name: therapistData.user.name,
        email: therapistData.user.email,
        passwordHash: hash,
        role: therapistData.user.role,
        phone: therapistData.user.phone,
        gender: therapistData.user.gender,
        emailVerified: therapistData.user.emailVerified,
        phoneVerified: therapistData.user.phoneVerified,
        profileComplete: therapistData.user.profileComplete,
        address: therapistData.user.address || null,
      });

      await TherapistProfile.create({
        userId: user._id,
        title: therapistData.profile.title,
        bio: therapistData.profile.bio,
        languages: therapistData.profile.languages,
        servicesInPostalCodes: therapistData.profile.servicesInPostalCodes,
        experience: therapistData.profile.experience,
        rating: therapistData.profile.rating,
        ratingCount: therapistData.profile.ratingCount,
        isVerified: therapistData.profile.isVerified,
        active: therapistData.profile.active,
      });

      console.log(`Therapist created: ${user.email} + profile`);
    }

    // ── Summary ──
    console.log("\n──────────────────────────────────────");
    console.log("  Seed complete! Dev credentials:");
    console.log("──────────────────────────────────────");
    console.log(`  Admin:      ${adminData.email} / ${adminData.password}`);
    usersData.forEach((u) => {
      console.log(`  User:       ${u.email} / ${u.password}`);
    });
    therapistsData.forEach((t) => {
      console.log(`  Therapist:  ${t.user.email} / ${t.user.password}`);
    });
    console.log("──────────────────────────────────────\n");
  } catch (error) {
    console.error("Seed failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
}

seed();
