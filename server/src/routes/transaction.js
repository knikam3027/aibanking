const router = require('express').Router();
const auth = require('../middleware/auth');
const transactionController = require('../controllers/transactionController');

router.get('/', auth, transactionController.getTransactions);
router.post('/transfer', auth, transactionController.transfer);
router.post('/transfer-voice', auth, transactionController.transferWithVoice);
router.get('/pending/:id', auth, transactionController.getPendingTransferStatus);

module.exports = router;
