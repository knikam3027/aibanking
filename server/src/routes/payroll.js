const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const payrollController = require('../controllers/payrollController');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for PDF upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `salary_${Date.now()}_${Math.round(Math.random() * 1000)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// All routes require auth + admin
router.use(auth, admin);

// Upload salary PDF and parse
router.post('/upload', upload.single('file'), payrollController.uploadSalaryPdf);

// Verify accounts (₹1 token)
router.post('/:batchId/verify', payrollController.verifyAccounts);

// Review batch before payment
router.get('/:batchId/review', payrollController.reviewBatch);

// Confirm and process payments
router.post('/:batchId/pay', payrollController.confirmAndPay);

// Get all batches
router.get('/batches', payrollController.getBatches);

// Get batch details
router.get('/:batchId', payrollController.getBatchDetails);

module.exports = router;
