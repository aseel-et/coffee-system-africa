const jwt = require('jsonwebtoken');
const db = require('../database/connection');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'رمز المصادقة مطلوب' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await db.prepare('SELECT id, username, full_name, role, is_active FROM users WHERE id = ?').get(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'المستخدم غير موجود' });
    }
    
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'الحساب معطل، تواصل مع المدير' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'رمز المصادقة غير صالح أو منتهي الصلاحية' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'هذا الإجراء يتطلب صلاحيات المدير' });
  }
  next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية للقيام بهذا الإجراء' });
    }
    next();
  };
};

module.exports = { authenticateToken, requireAdmin, requireRole };
