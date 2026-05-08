const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');

// Helper function to check for circular references
async function hasCircularReference(categoryId, newParentId) {
  if (!newParentId || categoryId === newParentId) return categoryId === newParentId;
  let currentId = newParentId;
  const visited = new Set();
  while (currentId) {
    if (visited.has(currentId)) return true; // Cycle detected
    visited.add(currentId);
    if (currentId === categoryId) return true; // Would point back to itself
    const result = await pool.query('SELECT parent_id FROM categories WHERE id = $1', [currentId]);
    currentId = result.rows[0]?.parent_id;
  }
  return false;
}

// GET /api/categories
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*,
             p.name AS parent_name,
             COUNT(n.id)::int AS notes_count
      FROM categories c
      LEFT JOIN categories p ON p.id = c.parent_id
      LEFT JOIN notes n ON n.category_id = c.id
      GROUP BY c.id, p.name
      ORDER BY c.parent_id NULLS FIRST, c.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/categories  (admin)
router.post('/', authenticate, authorize('admin'), [
  body('name').trim().notEmpty(),
  body('parent_id').optional({ checkFalsy: true }).isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, parent_id } = req.body;
  try {
    // For new categories, no circular check needed since they have no children yet
    const result = await pool.query(
      'INSERT INTO categories (name, parent_id) VALUES ($1,$2) RETURNING *',
      [name, parent_id || null]
    );
    await logActivity(req.user.id, 'create_category', 'category', result.rows[0].id, name);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/categories/:id  (admin)
router.patch('/:id', authenticate, authorize('admin'), [
  body('name').optional().trim().notEmpty(),
  body('parent_id').optional({ checkFalsy: true }).isInt(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, parent_id } = req.body;
  const categoryId = parseInt(req.params.id);
  try {
    // Check for circular reference
    if (parent_id !== undefined && await hasCircularReference(categoryId, parent_id)) {
      return res.status(400).json({ error: 'Circular reference detected in category hierarchy' });
    }

    const result = await pool.query(
      `UPDATE categories SET
         name = COALESCE($1, name),
         parent_id = $2
       WHERE id = $3 RETURNING *`,
      [name || null, parent_id !== undefined ? parent_id : null, categoryId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/categories/:id  (admin)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    // Check if in use
    const check = await pool.query('SELECT COUNT(*) FROM notes WHERE category_id = $1', [req.params.id]);
    if (parseInt(check.rows[0].count) > 0) {
      return res.status(409).json({ error: `Cannot delete — ${check.rows[0].count} notes use this category` });
    }
    const result = await pool.query('DELETE FROM categories WHERE id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Category not found' });
    await logActivity(req.user.id, 'delete_category', 'category', req.params.id, result.rows[0].name);
    res.json({ message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
