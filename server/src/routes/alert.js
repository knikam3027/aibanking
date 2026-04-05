const router = require('express').Router();
const auth = require('../middleware/auth');
const alertController = require('../controllers/alertController');

router.get('/', auth, alertController.getAlerts);
router.post('/generate-smart', auth, alertController.generateSmartAlerts);
router.patch('/:id/read', auth, alertController.markRead);

module.exports = router;
