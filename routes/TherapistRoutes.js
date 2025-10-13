

const  getTherapists  = require('../controller/therapistController/GetTherapist/getTherapists.js');

const express = require('express');
const authMiddleware = require('../models/middlewares/authtoken.js');

const TherapistTokenMiddleware = require('../models/middlewares/Therapisttoken')
const router = express.Router();

router.post("/filter",getTherapists);

router.post('/addavailability',TherapistTokenMiddleware,require('../controller/therapistController/schedule/addAvailabilty'));
router.post('/addtherapist',TherapistTokenMiddleware,require('../controller/therapistController/Add&DeleteTherapist/Addtherapist.js'));
router.get('/getalltherapistsnames',require('../controller/admin/payoutreport/getonlytherapistname'))

router.get('/getalltherapists',require('../controller/therapistController/GetTherapist/therapis(accept=true).js'));
router.post('/date',TherapistTokenMiddleware,require('../controller/therapistController/schedule/deleteAvailabilty').deleteAvailabilityByDate);
router.post('/availability/copy', TherapistTokenMiddleware ,require('../controller/therapistController/schedule/copyavailability.js'));
router.post('/blocks', TherapistTokenMiddleware, require('../controller/therapistController/schedule/deleteAvailabilty').deleteAvailabilityBlocks);
router.post('/availability/:id' , require('../controller/therapistController/schedule/getAvailabilityById.js'));
router.get('/availability/:id' , require('../controller/therapistController/schedule/getavailability'));

router.post("/dashboard/:therapistId",TherapistTokenMiddleware ,require('../controller/therapistController/Dashboard/dashboard.js'));
router.post('/bookings/revenue', TherapistTokenMiddleware ,require('../controller/therapistController/Dashboard/revenue.js'));
router.post("/reset",  require('../models/middlewares/verifyTherapist.js'), require('../controller/therapistController/schedule/DeleteEntireMonth.js'));
router.post('/next7days', TherapistTokenMiddleware ,require('../controller/therapistController/schedule/next7days.js'));
router.get('/filter',authMiddleware, require('../controller/therapistController/GetTherapist/getbypostalcode.js'));

//by Therapist flow
router.get('/list', require('../controller/therapistController/GetTherapist/bytherpist/getTherapist.js'));
router.get('/:therapistId/services' , require('../controller/services/therapistServices.js'));

//profile 
router.put('/edittherapist/:therapistId',authMiddleware, require('../controller/therapistController/Profile/editprofile.js'));
//bookings  of therpist // requires Authentication token
router.get('/getbookings',authMiddleware, require('../controller/therapistController/booking/booking.js'));
router.put('/completebooking/:bookingId',authMiddleware, require('../controller/therapistController/booking/updatebooking.js').MarkComplete);
router.put('/decline/:bookingId',authMiddleware,require('../models/middlewares/DeclineReason').cancellationValidator, require('../controller/therapistController/booking/updatebooking.js').declineBooking);
router.get('/decline/reasons', TherapistTokenMiddleware , require('../models/middlewares/DeclineReason').CancelReason)
//get by id
router.get('/:id',  require('../controller/therapistController/GetTherapist/therapistByID.js'));
module.exports = router;

