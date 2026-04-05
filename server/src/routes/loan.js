const router = require('express').Router();
const auth = require('../middleware/auth');
const loanController = require('../controllers/loanController');

router.post('/check-eligibility', auth, loanController.checkEligibility);
router.post('/apply', auth, loanController.apply);

module.exports = router;
