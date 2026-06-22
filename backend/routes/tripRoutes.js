const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  getTrips,
  generateNewTrip,
  detectDestination,
  getTripById,
  updateTrip,
  deleteTrip,
  addActivity,
  removeActivity,
  regenerateDay,
  regenerateTrip,
  generatePackingList
} = require('../controllers/tripController');

router.use(auth);

router.get('/', getTrips);
router.post('/', generateNewTrip);
router.post('/detect-destination', detectDestination);
router.get('/:id', getTripById);
router.put('/:id', updateTrip);
router.delete('/:id', deleteTrip);
router.post('/:id/activities', addActivity);
router.delete('/:id/activities', removeActivity);
router.post('/:id/days/:dayNumber/regenerate', regenerateDay);
router.post('/:id/regenerate', regenerateTrip);
router.post('/:id/packing-list', generatePackingList);

module.exports = router;
