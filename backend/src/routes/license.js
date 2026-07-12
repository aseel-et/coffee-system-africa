const express = require('express');
const router = express.Router();
const license = require('../license');

// GET /api/license/status
router.get('/status', (req, res) => {
  const status = license.getLicenseStatus();
  res.json({ success: true, data: status });
});

// POST /api/license/activate
router.post('/activate', (req, res) => {
  try {
    const { key } = req.body;
    
    if (!key || key.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'مفتاح التفعيل مطلوب' });
    }
    
    const result = license.activate(key);
    
    if (result.success) {
      return res.json({ success: true, message: result.message });
    } else {
      return res.status(400).json({ success: false, message: result.message });
    }
  } catch (err) {
    console.error('License activation error:', err);
    res.status(500).json({ success: false, message: 'خطأ في عملية التفعيل' });
  }
});

module.exports = router;
