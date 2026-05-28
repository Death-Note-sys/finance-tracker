const mysql = require('mysql2/promise');

/**
 * Parse Aiven/cloud DB_URL into a proper mysql2 config object with SSL.
 * mysql2 doesn't handle the `ssl-mode` query param from Aiven URLs,
 * so we manually parse the URL and set SSL correctly.
 */
function buildDbConfig(extraOptions = {}) {
  if (process.env.DB_URL) {
    // Strip any query params that mysql2 doesn't understand
    let urlStr = process.env.DB_URL;
    
    try {
      const url = new URL(urlStr.replace('mysql://', 'http://'));
      return {
        host: url.hostname,
        port: parseInt(url.port, 10) || 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1) || 'defaultdb',
        ssl: { rejectUnauthorized: false },
        ...extraOptions,
      };
    } catch (e) {
      console.error('Failed to parse DB_URL, using as-is:', e.message);
      return urlStr;
    }
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'finance_tracker',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    ...extraOptions,
  };
}

// Create a connection pool with promise wrapper
const pool = mysql.createPool({
  ...buildDbConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
});

/**
 * Initialize the database by creating all required tables if they don't exist.
 * This runs on server startup so the app is self-bootstrapping.
 */
async function initializeDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection(
      buildDbConfig({ multipleStatements: true })
    );

    // Only attempt to create the database if we are running locally (no DB_URL)
    // Managed databases like Aiven do not grant CREATE DATABASE permissions.
    if (!process.env.DB_URL) {
      const dbName = process.env.DB_NAME || 'finance_tracker';
      await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
      await connection.query(`USE \`${dbName}\``);
    }

    // ----- Users table -----
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        preferred_currency VARCHAR(3) DEFAULT 'INR',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ----- Expenses table -----
    await connection.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'INR',
        category ENUM('food','transport','utilities','entertainment','healthcare','education','shopping','rent','travel','other') DEFAULT 'other',
        expense_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_date (user_id, expense_date)
      )
    `);

    // ----- Income Sources table -----
    await connection.query(`
      CREATE TABLE IF NOT EXISTS income_sources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        source_name VARCHAR(200) NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'INR',
        frequency ENUM('one-time','daily','weekly','monthly','yearly') DEFAULT 'monthly',
        income_date DATE NOT NULL,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_date (user_id, income_date)
      )
    `);

    // ----- Savings Goals table -----
    await connection.query(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        goal_name VARCHAR(200) NOT NULL,
        target_amount DECIMAL(15,2) NOT NULL,
        current_amount DECIMAL(15,2) DEFAULT 0.00,
        currency VARCHAR(3) DEFAULT 'INR',
        deadline DATE,
        status ENUM('active','completed','cancelled') DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ----- Borrowings table -----
    await connection.query(`
      CREATE TABLE IF NOT EXISTS borrowings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        person_name VARCHAR(200) NOT NULL,
        type ENUM('lent','borrowed') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        amount_settled DECIMAL(15,2) DEFAULT 0.00,
        currency VARCHAR(3) DEFAULT 'INR',
        interest_rate DECIMAL(5,2) DEFAULT 0.00,
        interest_type ENUM('none','simple','compound') DEFAULT 'none',
        borrow_date DATE NOT NULL,
        due_date DATE,
        status ENUM('pending','partial','settled','overdue') DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Database initialized – all tables are ready');
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
}

module.exports = { pool, initializeDatabase };
