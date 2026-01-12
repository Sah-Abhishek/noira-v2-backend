const express = require('express');
const cors = require('cors');
const qs = require("qs");
const fileUpload = require("express-fileupload");
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// ===============================
// Load environment variables
// ===============================
dotenv.config({ path: '/etc/secrets/stripe.env' });
dotenv.config({ path: './.env' });

const PORT = process.env.PORT && !isNaN(process.env.PORT) ? parseInt(process.env.PORT, 10) : 3000;

const app = express();
const connectDB = require('./db/db.js');
connectDB();

// ===============================
// Security: CORS Configuration
// ===============================
const allowedOrigins = ['https://noira.co.uk', 'https://www.noira.co.uk'];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true // Enable if you are using cookies or sessions
}));

// JSON middleware, except for /webhook
app.use((req, res, next) => {
  if (req.originalUrl === "/api/webhook") {
    next();
  } else {
    express.json()(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: "/tmp/"
}));

// ===============================
// Health endpoint
// ===============================
app.get('/api/health', (req, res) => {
  res.json({
    status: "ok",
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    stripe: process.env.STRIPE_SECRET_KEY ? "loaded" : "missing",
    port: PORT
  });
});

// ===============================
// Background Tasks (Cron)
// ===============================
const location_cron = require('./bgwork/ServiceLocation'); location_cron();
const autocomplete_cron = require('./bgwork/autocompletebooking'); autocomplete_cron();
const remaindermail_cron = require('./bgwork/remainder'); remaindermail_cron();
const incative_cron = require('./controller/admin/autosendMailOfInactiveTherapsit'); incative_cron();

// ===============================
// Routes
// ===============================
const userAuth = require('./routes/userAuth.js');
const Adminroutes = require('./routes/Adminroutes');
const Bookingroute = require('./routes/BookingRoute.js');
const therapistRoutes = require('./routes/TherapistRoutes.js');
const login_User = require('./controller/admin/adminlogin');
const tokenHandler = require('./controller/tokenHandler.js');
const login_Therapist = require('./controller/therapistController/AUTH/therapistlogin.js');
const verifyAdmin = require('./models/middlewares/verifyadmin.js');
const authmiddleware = require('./models/middlewares/authtoken');

app.post('/api/webhook', express.raw({ type: 'application/json' }), require('./routes/webhook'));
app.get('/api/', (req, res) => res.send("Hello from server"));

app.use('/api/auth', require('./routes/google.js'));
app.use('/api/auth/user', userAuth);
app.use('/api/user', require('./routes/userRoutes.js'));  
app.use('/api/admin', Adminroutes);
app.use('/api/verifyotp', require('./routes/otproutes.js'));
app.post('/api/auth/admin/login', login_User);
app.use('/api/auth/therapist/login', login_Therapist);
app.use('/api/therapist', therapistRoutes);
app.use('/api/services', require('./routes/servicesRoute.js'));
app.get('/api/auth/verifytoken', tokenHandler);

app.post('/api/payment/create-checkout-session', require("./controller/booking/create_booking.js"));
app.post('/api/payment/cashbooking', require("./controller/booking/bycashbooking"));

app.use('/api/bookings', Bookingroute);
app.use('/api/auth', require('./routes/forgotpasswordRoute/forgotpass.js'));
app.use('/api/otp', authmiddleware, require('./routes/OTProute'));
app.use('/api/payout', require('./routes/payoutRoute'));

app.get('/api/outcodes', require('./services/getoutcodes')); 
app.get('/api/blog', require('./controller/blog/blog').getBlogs);
app.get('/api/blog/:id', require('./controller/blog/blog').BlogID);

// ===============================
// Start Server
// ===============================
// Modified: Removed '0.0.0.0' to prevent listening on all interfaces.
// It will now default to localhost or the system default.
app.listen(PORT,'0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
});