const router = require('express').Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');
const { paginate, paginatedResponse } = require('../utils/pagination');

// GET /api/activity
router.get('/', authenticate, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM activity_logs');
    const dataRes  = await pool.query(
      `SELECT al.*, u.name AS user_name, u.role AS user_role
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    res.json(paginatedResponse(dataRes.rows, countRes.rows[0].count, page, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
