const router = require('express').Router();
const auth = require('../middleware/auth');
const accountController = require('../controllers/accountController');

router.get('/details', auth, accountController.getDetails);

module.exports = router;
