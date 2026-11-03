const mysql = require('mysql2/promise');
require('dotenv').config();

// Create connection pool with sensible defaults
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'carbonlens_db',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Test connection on startup
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(`[Database] Connected successfully to MySQL: ${process.env.DB_NAME || 'carbonlens_db'}`);
    connection.release();
  } catch (error) {
    console.error('[Database] Connection failed:', error.message);
  }
}

testConnection();

module.exports = pool;
