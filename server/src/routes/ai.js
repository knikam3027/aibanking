const router = require('express').Router();
const auth = require('../middleware/auth');
const aiController = require('../controllers/aiController');

router.post('/chat', auth, aiController.chat);
router.get('/chat-history', auth, aiController.getChatHistory);
router.get('/insights', auth, aiController.getInsights);
router.get('/predict-balance', auth, aiController.predictBalance);
router.get('/cashflow', auth, aiController.getCashFlow);
router.post('/transfer', auth, aiController.aiTransfer);

module.exports = router;
