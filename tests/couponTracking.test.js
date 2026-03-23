/**
 * Tests for coupon tracking in bookings.
 *
 * Unit tests verifying that booking-creation controllers persist
 * couponId, couponCode, and discountAmount on the booking document.
 *
 * All external dependencies (Mongoose models, Stripe, mail, SMS) are mocked.
 */

/* ── shared mock state (must be prefixed with "mock") ── */
let mockLastBookingCreated = null;
let mockLastPaymentCreated = null;
const mockCouponSave = jest.fn();
let mockCouponFindOneResult = null;

/* ── Mock: Booking model ── */
jest.mock("../models/BookingSchema", () => {
  const mockCreate = jest.fn(async (data) => {
    mockLastBookingCreated = { _id: "booking123", ...data };
    return mockLastBookingCreated;
  });
  const mockFindById = jest.fn().mockReturnValue({
    populate: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue({
          _id: "booking123",
          clientId: {
            _id: "user1",
            name: { first: "Test", last: "User" },
            email: "test@example.com",
            phone: "447700000001",
            address: { Building_No: "1", Street: "St", Locality: "L", PostalCode: "W1" },
          },
          therapistId: { _id: "tp1", title: "Therapist One" },
          serviceId: { _id: "svc1", name: "Massage" },
          date: new Date("2026-06-01"),
          slotStart: new Date("2026-06-01T10:00:00Z"),
          slotEnd: new Date("2026-06-01T11:00:00Z"),
          price: { amount: 80 },
          paymentMode: "cash",
        }),
      }),
    }),
  });
  return { create: mockCreate, findById: mockFindById };
});

/* ── Mock: Coupon model ── */
jest.mock("../models/CouponSchema", () => ({
  findOne: jest.fn(async () => mockCouponFindOneResult),
}));

/* ── Mock: Service model ── */
jest.mock("../models/ServiceSchema", () => ({
  findById: jest.fn(async () => ({
    _id: "svc1",
    name: "Massage",
    options: [{ price: { amount: 100 }, durationMinutes: 60 }],
  })),
}));

/* ── Mock: User model ── */
jest.mock("../models/userSchema", () => ({
  findOne: jest.fn(async () => ({
    _id: "user1",
    name: { first: "Test", last: "User" },
    email: "test@example.com",
    phone: "447700000001",
    address: { Building_No: "1", Street: "St", Locality: "L", PostalCode: "W1" },
  })),
}));

/* ── Mock: Availability ── */
jest.mock("../models/AvailabilitySchema", () => ({
  findOne: jest.fn(async () => null),
}));

/* ── Mock: TherapistProfile ── */
jest.mock("../models/TherapistProfiles", () => ({
  findById: jest.fn().mockReturnValue({
    populate: jest.fn().mockResolvedValue({
      userId: {
        _id: "therapistUser1",
        email: "therapist@example.com",
        phone: "447700000100",
      },
    }),
  }),
}));

/* ── Mock: Payment model ── */
jest.mock("../models/PaymentSchema", () => ({
  create: jest.fn(async (data) => {
    mockLastPaymentCreated = data;
    return data;
  }),
}));

/* ── Mock: Stripe ── */
jest.mock("stripe", () => {
  return jest.fn(() => ({
    checkout: {
      sessions: {
        create: jest.fn(async () => ({ url: "https://stripe.test/session" })),
      },
    },
  }));
});

/* ── Mock: sendmail & sms ── */
jest.mock("../utils/sendmail", () => jest.fn(async () => {}));
jest.mock("../utils/smsService", () => jest.fn(async () => {}));

/* ── Mock: env ── */
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.FRONTEND_URL = "http://localhost:3000";

/* ── Helpers ── */
function makeCoupon(overrides = {}) {
  return {
    _id: "coupon123",
    code: "SAVE20",
    type: "percentage",
    value: 20,
    isActive: true,
    expiryDate: new Date("2030-01-01"),
    maxUses: 0,
    usedCount: 0,
    minOrderAmount: 0,
    save: mockCouponSave,
    ...overrides,
  };
}

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

/* ================================================================
   TEST SUITES
   ================================================================ */

describe("Coupon tracking in bookings", () => {
  beforeEach(() => {
    mockLastBookingCreated = null;
    mockLastPaymentCreated = null;
    mockCouponSave.mockClear();
    mockCouponFindOneResult = null;
  });

  /* ──────────────────────────────────────────────
     Online booking (create_booking.js / Stripe)
     ────────────────────────────────────────────── */
  describe("Online booking (create_booking.js)", () => {
    const createBooking = require("../controller/booking/create_booking");

    test("saves couponId, couponCode, and discountAmount when a valid percentage coupon is used", async () => {
      mockCouponFindOneResult = makeCoupon({ type: "percentage", value: 20 });

      const req = {
        body: {
          couponCode: "save20",
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "test",
          name: "Test User",
          mobileNumber: "7700000001",
          PostalCode: "W1",
        },
      };
      const res = makeRes();
      await createBooking(req, res);

      expect(mockLastBookingCreated).not.toBeNull();
      expect(mockLastBookingCreated.couponId).toBe("coupon123");
      expect(mockLastBookingCreated.couponCode).toBe("SAVE20");
      expect(mockLastBookingCreated.discountAmount).toBe(20); // 20% of 100
      expect(mockLastBookingCreated.price.amount).toBe(80);
      expect(mockCouponSave).toHaveBeenCalled();
    });

    test("saves coupon info for a fixed-amount coupon", async () => {
      mockCouponFindOneResult = makeCoupon({ type: "fixed", value: 30 });

      const req = {
        body: {
          couponCode: "SAVE20",
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "",
          name: "Test User",
          mobileNumber: "7700000001",
          PostalCode: "W1",
        },
      };
      const res = makeRes();
      await createBooking(req, res);

      expect(mockLastBookingCreated.couponId).toBe("coupon123");
      expect(mockLastBookingCreated.couponCode).toBe("SAVE20");
      expect(mockLastBookingCreated.discountAmount).toBe(30);
      expect(mockLastBookingCreated.price.amount).toBe(70);
    });

    test("saves coupon info for a free coupon", async () => {
      mockCouponFindOneResult = makeCoupon({ type: "free" });

      const req = {
        body: {
          couponCode: "SAVE20",
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "",
          name: "Test User",
          mobileNumber: "7700000001",
          PostalCode: "W1",
        },
      };
      const res = makeRes();
      await createBooking(req, res);

      expect(mockLastBookingCreated.couponId).toBe("coupon123");
      expect(mockLastBookingCreated.discountAmount).toBe(100);
      expect(mockLastBookingCreated.price.amount).toBe(0);
    });

    test("does NOT save coupon info when no coupon code is provided", async () => {
      const req = {
        body: {
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "",
          name: "Test User",
          mobileNumber: "7700000001",
          PostalCode: "W1",
        },
      };
      const res = makeRes();
      await createBooking(req, res);

      expect(mockLastBookingCreated.couponId).toBeNull();
      expect(mockLastBookingCreated.couponCode).toBeNull();
      expect(mockLastBookingCreated.discountAmount).toBe(0);
      expect(mockLastBookingCreated.price.amount).toBe(100);
    });

    test("does NOT save coupon info when coupon is inactive", async () => {
      mockCouponFindOneResult = makeCoupon({ isActive: false });

      const req = {
        body: {
          couponCode: "SAVE20",
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "",
          name: "Test User",
          mobileNumber: "7700000001",
          PostalCode: "W1",
        },
      };
      const res = makeRes();
      await createBooking(req, res);

      expect(mockLastBookingCreated.couponId).toBeNull();
      expect(mockLastBookingCreated.couponCode).toBeNull();
      expect(mockLastBookingCreated.discountAmount).toBe(0);
      expect(mockLastBookingCreated.price.amount).toBe(100);
    });

    test("does NOT save coupon info when coupon is expired", async () => {
      mockCouponFindOneResult = makeCoupon({ expiryDate: new Date("2020-01-01") });

      const req = {
        body: {
          couponCode: "SAVE20",
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "",
          name: "Test User",
          mobileNumber: "7700000001",
          PostalCode: "W1",
        },
      };
      const res = makeRes();
      await createBooking(req, res);

      expect(mockLastBookingCreated.couponId).toBeNull();
      expect(mockLastBookingCreated.discountAmount).toBe(0);
    });

    test("does NOT save coupon info when usage limit is reached", async () => {
      mockCouponFindOneResult = makeCoupon({ maxUses: 5, usedCount: 5 });

      const req = {
        body: {
          couponCode: "SAVE20",
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "",
          name: "Test User",
          mobileNumber: "7700000001",
          PostalCode: "W1",
        },
      };
      const res = makeRes();
      await createBooking(req, res);

      expect(mockLastBookingCreated.couponId).toBeNull();
      expect(mockLastBookingCreated.discountAmount).toBe(0);
    });
  });

  /* ──────────────────────────────────────────────
     Cash booking (bycashbooking.js)
     ────────────────────────────────────────────── */
  describe("Cash booking (bycashbooking.js)", () => {
    const createCashBooking = require("../controller/booking/bycashbooking");

    test("saves couponId, couponCode, and discountAmount when a valid coupon is used", async () => {
      mockCouponFindOneResult = makeCoupon({ type: "percentage", value: 25 });

      const req = {
        body: {
          couponCode: "save20",
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "cash test",
          name: "Test User",
          phone: "7700000001",
          address: { Building_No: "1", Street: "St", Locality: "L", PostalCode: "W1" },
        },
      };
      const res = makeRes();
      await createCashBooking(req, res);

      expect(mockLastBookingCreated).not.toBeNull();
      expect(mockLastBookingCreated.couponId).toBe("coupon123");
      expect(mockLastBookingCreated.couponCode).toBe("SAVE20");
      expect(mockLastBookingCreated.discountAmount).toBe(25); // 25% of 100
      expect(mockLastBookingCreated.price.amount).toBe(75);
      expect(mockLastBookingCreated.paymentMode).toBe("cash");
    });

    test("does NOT save coupon info when no coupon is provided", async () => {
      const req = {
        body: {
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "",
          name: "Test User",
          phone: "7700000001",
          address: {},
        },
      };
      const res = makeRes();
      await createCashBooking(req, res);

      expect(mockLastBookingCreated.couponId).toBeNull();
      expect(mockLastBookingCreated.couponCode).toBeNull();
      expect(mockLastBookingCreated.discountAmount).toBe(0);
      expect(mockLastBookingCreated.price.amount).toBe(100);
    });

    test("saves coupon info for a fixed-amount coupon (cash)", async () => {
      mockCouponFindOneResult = makeCoupon({ type: "fixed", value: 15 });

      const req = {
        body: {
          couponCode: "FLAT15",
          email: "test@example.com",
          therapistId: "tp1",
          serviceId: "svc1",
          optionIndex: 0,
          date: "2026-06-01",
          time: "10:00",
          notes: "",
          name: "Test User",
          phone: "7700000001",
          address: {},
        },
      };
      const res = makeRes();
      await createCashBooking(req, res);

      expect(mockLastBookingCreated.couponId).toBe("coupon123");
      expect(mockLastBookingCreated.discountAmount).toBe(15);
      expect(mockLastBookingCreated.price.amount).toBe(85);
    });
  });
});

/* ──────────────────────────────────────────────
   BookingSchema field validation
   ────────────────────────────────────────────── */
describe("BookingSchema has coupon tracking fields", () => {
  test("schema source includes couponId, couponCode, and discountAmount", () => {
    const fs = require("fs");
    const path = require("path");
    const schemaSource = fs.readFileSync(
      path.join(__dirname, "../models/BookingSchema.js"),
      "utf8"
    );

    expect(schemaSource).toContain("couponId");
    expect(schemaSource).toContain('ref: "Coupon"');
    expect(schemaSource).toContain("couponCode");
    expect(schemaSource).toContain("discountAmount");
  });
});
