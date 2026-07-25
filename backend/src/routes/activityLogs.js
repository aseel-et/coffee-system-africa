const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET /api/activity-logs
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { from_date, to_date, user_id, action_type, module, limit = 100, offset = 0 } = req.query;
    let query = 'SELECT * FROM activity_logs WHERE 1=1';
    const params = [];
    
    if (from_date) { query += ' AND DATE(created_at) >= ?'; params.push(from_date); }
    if (to_date) { query += ' AND DATE(created_at) <= ?'; params.push(to_date); }
    if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
    if (action_type) { query += ' AND action_type = ?'; params.push(action_type); }
    if (module) { query += ' AND module = ?'; params.push(module); }
    
    const countResult = await db.prepare(query.replace('SELECT *', 'SELECT COUNT(*) as total')).get(...params);
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const logs = await db.prepare(query).all(...params);
    res.json({ success: true, data: logs, total: countResult.total });
  } catch (err) {
    res.status(500).json({ success: false, message: 'خطأ في جلب سجل الأنشطة' });
  }
});

module.exports = router;
