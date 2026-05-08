const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const { paginate, paginatedResponse } = require('../utils/pagination');

// GET /api/users  (admin/supervisor)
router.get('/', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  try {
    const countRes = await pool.query('SELECT COUNT(*) FROM users');
    const dataRes = await pool.query(`
      SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
             COUNT(n.id)::int AS notes_count
      FROM users u
      LEFT JOIN notes n ON n.agent_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    res.json(paginatedResponse(dataRes.rows, countRes.rows[0].count, page, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id  (admin)
router.patch('/:id', authenticate, authorize('admin'), [
  body('name').optional().trim().notEmpty(),
  body('role').optional().isIn(['admin', 'supervisor', 'agent']),
  body('password').optional().isLength({ min: 8 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const updates = [];
  const params = [];
  const { name, role, active, password } = req.body;

  if (name !== undefined)   { params.push(name);   updates.push(`name = $${params.length}`); }
  if (role !== undefined)   { params.push(role);   updates.push(`role = $${params.length}`); }
  if (active !== undefined) { params.push(active); updates.push(`active = $${params.length}`); }
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    params.push(hash);
    updates.push(`password = $${params.length}`);
  }
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}
       RETURNING id, name, email, role, active`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    await logActivity(req.user.id, 'update_user', 'user', result.rows[0].id, result.rows[0].name);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id  (admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  try {
    // Soft delete (deactivate)
    const result = await pool.query(
      'UPDATE users SET active = false WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
