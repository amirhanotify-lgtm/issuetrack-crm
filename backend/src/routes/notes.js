const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const { paginate, paginatedResponse } = require('../utils/pagination');

// GET /api/notes  (with filters)
router.get('/', authenticate, async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  const { status, priority, category_id, client_id, agent_id, q, from, to } = req.query;
  try {
    const conditions = [];
    const params = [];

    // Agents can only see their own notes
    if (req.user.role === 'agent') {
      params.push(req.user.id);
      conditions.push(`n.agent_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      conditions.push(`n.status = $${params.length}`);
    }
    if (priority) {
      params.push(priority);
      conditions.push(`n.priority = $${params.length}`);
    }
    if (category_id) {
      params.push(category_id);
      conditions.push(`n.category_id = $${params.length}`);
    }
    if (client_id) {
      params.push(client_id);
      conditions.push(`n.client_id = $${params.length}`);
    }
    if (agent_id) {
      params.push(agent_id);
      conditions.push(`n.agent_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(n.title ILIKE $${params.length} OR n.description ILIKE $${params.length})`);
    }
    if (from) {
      params.push(from);
      conditions.push(`n.created_at >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`n.created_at <= $${params.length}`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM notes n ${where}`,
      params
    );
    const dataRes = await pool.query(
      `SELECT n.*,
              cl.name  AS client_name,
              cl.phone AS client_phone,
              u.name   AS agent_name,
              cat.name AS category_name
       FROM notes n
       LEFT JOIN clients    cl  ON cl.id  = n.client_id
       LEFT JOIN users      u   ON u.id   = n.agent_id
       LEFT JOIN categories cat ON cat.id = n.category_id
       ${where}
       ORDER BY n.updated_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    res.json(paginatedResponse(dataRes.rows, countRes.rows[0].count, page, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notes/search  (duplicate detection — by title similarity)
router.get('/search', authenticate, async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 3) return res.json([]);
  try {
    const result = await pool.query(
      `SELECT n.id, n.title, n.counter, n.status, n.priority,
              cl.name AS client_name, cat.name AS category_name
       FROM notes n
       LEFT JOIN clients    cl  ON cl.id  = n.client_id
       LEFT JOIN categories cat ON cat.id = n.category_id
       WHERE n.title ILIKE $1
       ORDER BY n.counter DESC
       LIMIT 5`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/notes/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*,
              cl.name  AS client_name, cl.phone AS client_phone,
              u.name   AS agent_name,  u.email  AS agent_email,
              cat.name AS category_name
       FROM notes n
       LEFT JOIN clients    cl  ON cl.id  = n.client_id
       LEFT JOIN users      u   ON u.id   = n.agent_id
       LEFT JOIN categories cat ON cat.id = n.category_id
       WHERE n.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Note not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notes
router.post('/', authenticate, [
  body('client_id').isInt(),
  body('category_id').optional({ checkFalsy: true }).isInt(),
  body('title').trim().notEmpty(),
  body('priority').isIn(['Low', 'Medium', 'High']),
  body('status').optional().isIn(['Open', 'In Progress', 'Resolved']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { client_id, category_id, title, description, priority, status } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO notes (client_id, agent_id, category_id, title, description, priority, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [client_id, req.user.id, category_id || null, title, description || null,
       priority, status || 'Open']
    );
    await logActivity(req.user.id, 'create_note', 'note', result.rows[0].id, title);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/notes/:id
router.patch('/:id', authenticate, [
  body('priority').optional().isIn(['Low', 'Medium', 'High']),
  body('status').optional().isIn(['Open', 'In Progress', 'Resolved']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const allowed = ['client_id', 'category_id', 'title', 'description', 'priority', 'status'];
  const updates = [];
  const params = [];
  allowed.forEach(f => {
    if (req.body[f] !== undefined) {
      params.push(req.body[f]);
      updates.push(`${f} = $${params.length}`);
    }
  });

  // Auto-set resolved_at
  if (req.body.status === 'Resolved') {
    updates.push(`resolved_at = NOW()`);
  } else if (req.body.status && req.body.status !== 'Resolved') {
    updates.push(`resolved_at = NULL`);
  }

  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

  params.push(req.params.id);
  try {
    // Check ownership for agents
    if (req.user.role === 'agent') {
      const check = await pool.query('SELECT agent_id FROM notes WHERE id = $1', [req.params.id]);
      if (check.rows[0]?.agent_id !== req.user.id) {
        return res.status(403).json({ error: 'Cannot edit another agent\'s note' });
      }
    }
    const result = await pool.query(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Note not found' });
    await logActivity(req.user.id, 'update_note', 'note', result.rows[0].id, result.rows[0].title,
      { changes: Object.keys(req.body) });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/notes/:id/increment
router.post('/:id/increment', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE notes
       SET counter = counter + 1, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Note not found' });
    await logActivity(req.user.id, 'increment_counter', 'note',
      result.rows[0].id, result.rows[0].title,
      { new_counter: result.rows[0].counter });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notes/:id  (admin/supervisor)
router.delete('/:id', authenticate, authorize('admin', 'supervisor'), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM notes WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Note not found' });
    await logActivity(req.user.id, 'delete_note', 'note', req.params.id, result.rows[0].title);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
