const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/bookingController');
const { verifyToken } = require('../middleware/auth');

router.get('/today',          verifyToken, ctrl.getTodayBookings);
router.get('/week',           verifyToken, ctrl.getWeeklyBookings);
router.get('/day',            verifyToken, ctrl.getDaySchedule);
router.get('/rules',          verifyToken, ctrl.getBookingRules);
router.post('/',              verifyToken, ctrl.createBooking);
router.post('/recurring',     verifyToken, ctrl.createRecurringBooking);
router.put('/:id',            verifyToken, ctrl.updateBooking);
router.delete('/:id',         verifyToken, ctrl.cancelBooking);
router.patch('/:id/checkin',  verifyToken, ctrl.checkIn);

module.exports = router;
