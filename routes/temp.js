// routes/payment.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
} else {
  console.warn('⚠️  Stripe API key not configured. Temporary routes will not function properly.');
}

// POST /create-checkout-session
router.post("/create-checkout-session", async (req, res) => {
  try {
    const { items, customerEmail } = req.body;
 
    // Convert cart items to Stripe line items
    const line_items = items.map(item => ({
      price_data: {
        currency: "gbp",
        product_data: {
          name: item.name,
        },
        unit_amount: item.price * 100, // amount in pence
      },
      quantity: item.quantity,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: customerEmail,
      line_items,
      success_url: "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "http://localhost:5173/cancel",
    });

    res.json({ id: session.id });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
