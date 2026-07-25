const db = require('../database/connection');

const logActivity = async (userId, userName, actionType, module, description, referenceType = null, referenceId = null) => {
  try {
    await db.prepare(`
      INSERT INTO activity_logs (user_id, user_name, action_type, module, description, reference_type, reference_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, userName, actionType, module, description, referenceType, referenceId);
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

module.exports = { logActivity };
