const { Pool } = require('pg');
require('dotenv').config();

// Use managed service connection string when provided (Railway, Render, Heroku).
// Some hosts provide `DATABASE_URL` or `RAILWAY_DATABASE_URL` — accept both.
const connectionString = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL || null;

const pool = new Pool(
  connectionString
    ? {
        connectionString,
        // Allow connections to managed Postgres that require SSL without
        // strict certificate validation (common for platform-managed DBs).
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
        password: process.env.DB_PASSWORD || null,
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
