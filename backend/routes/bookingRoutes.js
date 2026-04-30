const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/bookingController');

router.get('/today',          ctrl.getTodayBookings);
router.get('/day',            ctrl.getDaySchedule);
router.get('/rules',          ctrl.getBookingRules);
router.post('/',              ctrl.createBooking);
router.post('/recurring',     ctrl.createRecurringBooking);
router.delete('/:id',         ctrl.cancelBooking);
router.patch('/:id/checkin',  ctrl.checkIn);

module.exports = router;
