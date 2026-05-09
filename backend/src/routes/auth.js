const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');
const { logActivity } = require('../utils/logger');
const { sendInvitationEmail } = require('../utils/email');

// ============================================================
// PUBLIC ENDPOINTS
// ============================================================

// POST /api/auth/signup - Sign up as first admin or via invitation
router.post('/signup', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().notEmpty(),
  body('token').optional(), // For invited users
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password, name, token } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if email already exists
    const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      throw new Error('Email already exists');
    }

    let role = 'admin'; // Default role for first user

    if (token) {
      // Sign up via invitation
      const invResult = await client.query(
        'SELECT * FROM invitations WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
        [token]
      );

      if (invResult.rows.length === 0) {
        throw new Error('Invalid or expired invitation');
      }

      const invitation = invResult.rows[0];
      if (invitation.email !== email) {
        throw new Error('Email does not match invitation');
      }

      role = invitation.role;

      // Mark invitation as used
      await client.query('UPDATE invitations SET used_at = NOW() WHERE id = $1', [invitation.id]);
    } else {
      // Check if this is the first user
      const adminCount = await client.query('SELECT COUNT(*) FROM users WHERE role = $1', ['admin']);
      if (adminCount.rows[0].count > 0) {
        throw new Error('Cannot create admin without invitation');
      }
    }

    // Create user
    const hash = await bcrypt.hash(password, 10);
    const result = await client.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role,active,created_at',
      [name, email, hash, role]
    );

    const newUser = result.rows[0];

    // Log activity
    await client.query(
      'INSERT INTO activity_logs (user_id, action, target_type, target_id, target_name) VALUES ($1, $2, $3, $4, $5)',
      [newUser.id, 'signup', 'user', newUser.id, name]
    );

    await client.query('COMMIT');

    // Generate JWT token
    const jwtToken = jwt.sign({ id: newUser.id, role: newUser.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    res.status(201).json({
      token: jwtToken,
      user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// GET /api/auth/invitation-info/:token - Get invitation details (public endpoint)
router.get('/invitation-info/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const result = await pool.query(
      'SELECT email, role FROM invitations WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    const invitation = result.rows[0];
    res.json(invitation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND active = true',
      [email]
    );
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    await logActivity(user.id, 'login', 'user', user.id, user.name);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// AUTHENTICATED ENDPOINTS
// ============================================================

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json(req.user);
});

// POST /api/auth/register - Admin direct user creation (not via invitation)
router.post('/register', authenticate, authorize('admin'), [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('role').isIn(['admin', 'supervisor', 'agent']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id,name,email,role,active,created_at',
      [name, email, hash, role]
    );
    
    await logActivity(req.user.id, 'create_user', 'user', result.rows[0].id, name);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/setup - Determine whether public signup is allowed
router.get('/setup', async (req, res) => {
  try {
    const result = await pool.query("SELECT COUNT(*) FROM users WHERE role = 'admin'");
    const adminsExist = Number(result.rows[0].count) > 0;
    res.json({ adminsExist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// ADMIN ENDPOINTS - INVITATIONS
// ============================================================

// POST /api/auth/invite - Send invitation to new user (admin only)
router.post('/invite', authenticate, authorize('admin'), [
  body('email').isEmail().normalizeEmail(),
  body('role').isIn(['admin', 'supervisor', 'agent']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { email, role } = req.body;

  try {
    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Check if invitation already exists and is pending
    const pendingInv = await pool.query(
      'SELECT id FROM invitations WHERE email = $1 AND used_at IS NULL AND expires_at > NOW()',
      [email]
    );
    if (pendingInv.rows.length > 0) {
      return res.status(409).json({ error: 'Pending invitation already exists for this email' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Create invitation
    const result = await pool.query(
      'INSERT INTO invitations (email, role, token, created_by) VALUES ($1, $2, $3, $4) RETURNING id, email, role, token, created_at, expires_at',
      [email, role, token, req.user.id]
    );

    const invitation = result.rows[0];

    // Send email
    try {
      await sendInvitationEmail(email, token, req.user.name);
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr);
      // Still return success but note the email failed
      return res.status(201).json({
        ...invitation,
        warning: 'Invitation created but email failed to send. Check Gmail credentials.',
      });
    }

    // Log activity
    await logActivity(req.user.id, 'invite_user', 'invitation', invitation.id, email);

    res.status(201).json(invitation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/invitations - List pending invitations (admin only)
router.get('/invitations', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, u.name as created_by_name 
       FROM invitations i 
       LEFT JOIN users u ON i.created_by = u.id 
       WHERE i.used_at IS NULL AND i.expires_at > NOW()
       ORDER BY i.created_at DESC`,
      []
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/invitations/:id/resend - Resend invitation email (admin only)
router.post('/invitations/:id/resend', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT * FROM invitations WHERE id = $1 AND used_at IS NULL',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already used' });
    }

    const invitation = result.rows[0];

    // Check if expired
    if (new Date(invitation.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Send email
    try {
      await sendInvitationEmail(invitation.email, invitation.token, req.user.name);
    } catch (emailErr) {
      return res.status(500).json({ error: 'Failed to send email: ' + emailErr.message });
    }

    res.json({ message: 'Invitation email resent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/invitations/:id - Cancel invitation (admin only)
router.delete('/invitations/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'DELETE FROM invitations WHERE id = $1 AND used_at IS NULL RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invitation not found or already used' });
    }

    await logActivity(req.user.id, 'cancel_invitation', 'invitation', id, '');

    res.json({ message: 'Invitation cancelled' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
