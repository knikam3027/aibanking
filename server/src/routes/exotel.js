const router = require('express').Router();
const exotelController = require('../controllers/exotelController');

// PUBLIC endpoints — Exotel callbacks (no auth required)
// These are called by Exotel servers during voice calls

// ExoML IVR document — serves the call script
router.get('/ivr/:transferId', exotelController.serveIVR);
router.post('/ivr/:transferId', exotelController.serveIVR);

// Digit callback — user pressed 1 or 2
router.get('/callback/:transferId', exotelController.handleCallback);
router.post('/callback/:transferId', exotelController.handleCallback);

// Call status updates
router.post('/status/:transferId', exotelController.handleStatusCallback);

// Local testing — simulate voice call response
router.post('/simulate/:transferId', exotelController.simulateCallback);

module.exports = router;
