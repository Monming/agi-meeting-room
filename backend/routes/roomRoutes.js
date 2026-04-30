const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/roomController');

router.get('/', ctrl.getAllRooms);
router.get('/search', ctrl.searchRooms);
router.get('/density', ctrl.getDensity);
router.post('/available', ctrl.getAvailableRooms);
router.post('/availability-by-timeslots', ctrl.getAvailabilityByTimeslots); // NEW
router.post('/', ctrl.createRoom);
router.put('/:id', ctrl.updateRoom);
router.delete('/:id', ctrl.deleteRoom);

module.exports = router;

