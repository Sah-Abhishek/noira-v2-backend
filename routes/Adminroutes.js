

const express = require('express');
const router = express.Router();

const verifyadmin = require('../models/middlewares/verifyadmin.js');   
const dashboard = require('../controller/admin/dashboard.js');
const authMiddleware = require('../models/middlewares/authtoken.js');

// Admin profile

router.get('/profile',verifyadmin, authMiddleware , require('../controller/admin/adminProfile/getProfile.js'))
router.put('/editprofile',verifyadmin, authMiddleware, require('../controller/admin/adminProfile/editprofile'))
router.get('/adminlist', verifyadmin, authMiddleware,require('../controller/admin/admin management/getAdmin'))
//therapist Routes
router.get('/therapist', verifyadmin ,  require('../controller/therapistController/GetTherapist/admin_get_therapsit.js'));
router.delete('/therapist/:id', verifyadmin ,  require('../controller/therapistController/Add&DeleteTherapist/deletetherapist.js'));
router.get('/therapist/list', verifyadmin ,  require('../controller/admin/therpist management/alltherapist.js'));
router.post('/createtherapist', verifyadmin ,  require('./Admin/createTherpist.js'));
router.post('/therapist/bulkaction', verifyadmin ,  require('../controller/admin/therpist management/bulkAction.js'));
router.put('/updatetherapist/:therapistId', verifyadmin ,  authMiddleware, require('../controller/admin/therpist management/editProfile.js'))
router.get('/active/therapistlist', require('../controller/admin/activeTherapist'))
router.get('/therapist/schedule/:therapistId', require('../controller/admin/therapistSchedule'))

//service Routes
router.post('/addservices', verifyadmin ,  require('../controller/admin/service management/addService.js'));
router.delete('/deleteservices/:id', verifyadmin ,   require('../controller/admin/service management/deleteService.js'));
router.put('/editservices/:id', verifyadmin ,   require('../controller/admin/service management/editService.js'));
router.get('/services/list', verifyadmin ,  require('../controller/services/massageServices.js'));
router.post('/postalcode', verifyadmin ,   require('../controller/admin/addlocation.js'));
router.get('/services/:id', verifyadmin ,  require('../controller/admin/service management/serviceById.js'));

//bookings
router.get('/bookings', verifyadmin ,  require('../controller/booking/get_booking.js').getAllBookings);
router.get('/dashboard', verifyadmin, dashboard);
router.get('/revenue', verifyadmin ,   require('../controller/admin/revenue.js'));
router.get('/bookings/therapist/:therapistId', verifyadmin ,   require('../controller/admin/bookingbytherapist.js'));
router.put('/booking/cancel/:id', verifyadmin, require('../controller/booking/update_booking.js').cancelBooking)
router.put('/booking/reschedule/:id', verifyadmin, require('../controller/booking/update_booking.js').rescheduleBooking)
//users management
router.get('/users', verifyadmin , require('../controller/admin/usermanagement/users.js'));

//admin management
router.post('/createadmin', authMiddleware , require('../controller/admin/admin management/addAdmin.js'))

//revenue
router.get('/revenue/bookings', require('../controller/admin/revenueOnbooking.js'))

//review route
router.get('/booking/reviews', require('../controller/admin/getRevies'))
router.post('/booking/reviews/:id/reply', require('../controller/admin/ReviewReply'))

//graph
router.get('/graph/therapist', require('../controller/admin/graphPlot/therapistSchedule'))

//banner management
router.post('/banners', verifyadmin, require('../controller/admin/banner/createBanner'))
router.get('/banners', verifyadmin, require('../controller/admin/banner/getBanners'))
router.put('/banners/:id', verifyadmin, require('../controller/admin/banner/updateBanner'))
router.delete('/banners/:id', verifyadmin, require('../controller/admin/banner/deleteBanner'))

//coupon management
router.post('/coupons', verifyadmin, require('../controller/admin/coupon/createCoupon'))
router.get('/coupons', verifyadmin, require('../controller/admin/coupon/getCoupons'))
router.put('/coupons/:id', verifyadmin, require('../controller/admin/coupon/updateCoupon'))
router.delete('/coupons/:id', verifyadmin, require('../controller/admin/coupon/deleteCoupon'))

module.exports = router;
