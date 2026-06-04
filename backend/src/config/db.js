const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('connect', () => console.log('Conectado a Supabase (PostgreSQL)'));
pool.on('error', (err) => console.error('Error en PostgreSQL:', err.message));

module.exports = pool;