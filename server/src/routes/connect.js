const router = require('express').Router();
const auth = require('../middleware/auth');
const connectController = require('../controllers/connectController');

router.get('/verification/:id', auth, connectController.getVerificationStatus);
router.post('/verification/:id/simulate', auth, connectController.simulateVerification);

module.exports = router;
