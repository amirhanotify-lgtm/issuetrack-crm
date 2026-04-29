const pool = require('../db/pool');

async function logActivity(userId, action, targetType, targetId, targetName, meta = null) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, target_type, target_id, target_name, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, targetType, targetId, targetName, meta ? JSON.stringify(meta) : null]
    );
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity };
