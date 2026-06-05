const { Pool } = require('pg');
require('dotenv').config();

// Use DATABASE_URL when provided (Render, Heroku, or other managed hosts).
// Remote hosts typically require SSL — enable it for the connection string.
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'issuetrack_crm',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('✓ Database connected');
  }
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

module.exports = pool;
