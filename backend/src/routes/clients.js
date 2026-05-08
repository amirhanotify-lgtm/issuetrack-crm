const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const { paginate, paginatedResponse } = require('../utils/pagination');

// GET /api/clients
router.get('/', authenticate, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const { q } = req.query;
  try {
    const conditions = ['c.active = true'];
    const params = [];
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR c.email ILIKE $${params.length})`);
    }
    const where = 'WHERE ' + conditions.join(' AND ');
    const countRes = await pool.query(`SELECT COUNT(*) FROM clients c ${where}`, params);
    const dataRes  = await pool.query(
      `SELECT c.*, 
              COUNT(DISTINCT n.id) AS notes_count,
              MAX(n.updated_at)    AS last_activity
       FROM clients c
       LEFT JOIN notes n ON n.client_id = c.id
       ${where}
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(paginatedResponse(dataRes.rows, countRes.rows[0].count, page, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/clients/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const clientRes = await pool.query('SELECT * FROM clients WHERE id = $1', [req.params.id]);
    if (!clientRes.rows[0]) return res.status(404).json({ error: 'Client not found' });

    const notesRes = await pool.query(
      `SELECT n.*, c.name AS category_name, u.name AS agent_name
       FROM notes n
       LEFT JOIN categories c ON c.id = n.category_id
       LEFT JOIN users u ON u.id = n.agent_id
       WHERE n.client_id = $1
       ORDER BY n.updated_at DESC`,
      [req.params.id]
    );
    res.json({ ...clientRes.rows[0], notes: notesRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/clients
router.post('/', authenticate, [
  body('name').trim().notEmpty(),
  body('phone').trim().notEmpty(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, phone, email, company } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO clients (name, phone, email, company)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, phone, email || null, company || null]
    );
    await logActivity(req.user.id, 'create_client', 'client', result.rows[0].id, name);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already exists' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/clients/:id
router.patch('/:id', authenticate, [
  body('name').optional().trim().notEmpty(),
  body('phone').optional().trim().notEmpty(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const fields = ['name', 'phone', 'email', 'company'];
  const updates = [];
  const params = [];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  });
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE clients SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
    await logActivity(req.user.id, 'update_client', 'client', result.rows[0].id, result.rows[0].name);
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Phone number already exists' });
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/clients/:id  (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE clients SET active = false WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Client not found' });
    await logActivity(req.user.id, 'delete_client', 'client', req.params.id, result.rows[0].name);
    res.json({ message: 'Client deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
