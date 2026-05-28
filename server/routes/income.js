const express = require('express');
const { pool } = require('../config/db');
const authenticate = require('../middleware/auth');
const {
  validateIncome,
  validateIncomeQuery,
  validateIdParam,
} = require('../middleware/validate');

const router = express.Router();

// All income routes are protected
router.use(authenticate);

// ─────────────────────────────────────────────────
// GET /api/income
// List income sources with optional filters: month, year
// ─────────────────────────────────────────────────
router.get('/', validateIncomeQuery, async (req, res) => {
  try {
    const { month, year } = req.query;
    const userId = req.user.userId;

    let sql = 'SELECT * FROM income_sources WHERE user_id = ?';
    const params = [userId];

    if (month) {
      sql += ' AND MONTH(income_date) = ?';
      params.push(parseInt(month, 10));
    }
    if (year) {
      sql += ' AND YEAR(income_date) = ?';
      params.push(parseInt(year, 10));
    }

    sql += ' ORDER BY income_date DESC';

    const [rows] = await pool.query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Get income error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching income sources.',
    });
  }
});

// ─────────────────────────────────────────────────
// POST /api/income
// Create a new income source
// ─────────────────────────────────────────────────
router.post('/', validateIncome, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { source_name, amount, frequency, income_date, notes, currency } = req.body;

    const [result] = await pool.query(
      `INSERT INTO income_sources (user_id, source_name, amount, frequency, income_date, notes, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, source_name, amount, frequency || 'monthly', income_date, notes || null, currency || 'INR']
    );

    const [rows] = await pool.query('SELECT * FROM income_sources WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Income source created successfully.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Create income error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating income source.',
    });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/income/:id
// Update an income source (verify ownership)
// ─────────────────────────────────────────────────
router.put('/:id', validateIdParam, validateIncome, async (req, res) => {
  try {
    const userId = req.user.userId;
    const incomeId = req.params.id;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM income_sources WHERE id = ? AND user_id = ?',
      [incomeId, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Income source not found or access denied.',
      });
    }

    const { source_name, amount, frequency, income_date, notes, currency } = req.body;

    await pool.query(
      `UPDATE income_sources
       SET source_name = ?, amount = ?, frequency = ?, income_date = ?, notes = ?, currency = ?
       WHERE id = ? AND user_id = ?`,
      [source_name, amount, frequency || 'monthly', income_date, notes || null, currency || 'INR', incomeId, userId]
    );

    const [rows] = await pool.query('SELECT * FROM income_sources WHERE id = ?', [incomeId]);

    return res.json({
      success: true,
      message: 'Income source updated successfully.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Update income error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating income source.',
    });
  }
});

// ─────────────────────────────────────────────────
// DELETE /api/income/:id
// Delete an income source (verify ownership)
// ─────────────────────────────────────────────────
router.delete('/:id', validateIdParam, async (req, res) => {
  try {
    const userId = req.user.userId;
    const incomeId = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM income_sources WHERE id = ? AND user_id = ?',
      [incomeId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Income source not found or access denied.',
      });
    }

    return res.json({
      success: true,
      message: 'Income source deleted successfully.',
    });
  } catch (error) {
    console.error('Delete income error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting income source.',
    });
  }
});

module.exports = router;
