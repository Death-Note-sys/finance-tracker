const express = require('express');
const { pool } = require('../config/db');
const authenticate = require('../middleware/auth');
const {
  validateExpense,
  validateExpenseQuery,
  validateIdParam,
} = require('../middleware/validate');

const router = express.Router();

// All expense routes are protected
router.use(authenticate);

// ─────────────────────────────────────────────────
// GET /api/expenses
// List user expenses with optional filters: month, year, category
// ─────────────────────────────────────────────────
router.get('/', validateExpenseQuery, async (req, res) => {
  try {
    const { month, year, category } = req.query;
    const userId = req.user.userId;

    let sql = 'SELECT * FROM expenses WHERE user_id = ?';
    const params = [userId];

    if (month) {
      sql += ' AND MONTH(expense_date) = ?';
      params.push(parseInt(month, 10));
    }
    if (year) {
      sql += ' AND YEAR(expense_date) = ?';
      params.push(parseInt(year, 10));
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY expense_date DESC';

    const [rows] = await pool.query(sql, params);

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching expenses.',
    });
  }
});

// ─────────────────────────────────────────────────
// GET /api/expenses/summary
// Monthly summary grouped by category (useful for pie charts)
// ─────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.userId;
    const { month, year } = req.query;

    // Default to current month/year if not specified
    const now = new Date();
    const targetMonth = month ? parseInt(month, 10) : now.getMonth() + 1;
    const targetYear = year ? parseInt(year, 10) : now.getFullYear();

    const [rows] = await pool.query(
      `SELECT
         category,
         COUNT(*) AS transaction_count,
         SUM(amount) AS total_amount
       FROM expenses
       WHERE user_id = ?
         AND MONTH(expense_date) = ?
         AND YEAR(expense_date) = ?
       GROUP BY category
       ORDER BY total_amount DESC`,
      [userId, targetMonth, targetYear]
    );

    // Also compute the grand total
    const grandTotal = rows.reduce(
      (sum, row) => sum + parseFloat(row.total_amount || 0),
      0
    );

    return res.json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        grand_total: grandTotal.toFixed(2),
        categories: rows,
      },
    });
  } catch (error) {
    console.error('Expense summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching expense summary.',
    });
  }
});

// ─────────────────────────────────────────────────
// POST /api/expenses
// Create a new expense
// ─────────────────────────────────────────────────
router.post('/', validateExpense, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { title, amount, category, expense_date, notes, currency } = req.body;

    const [result] = await pool.query(
      `INSERT INTO expenses (user_id, title, amount, category, expense_date, notes, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, title, amount, category || 'other', expense_date, notes || null, currency || 'INR']
    );

    // Fetch the newly created record
    const [rows] = await pool.query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Expense created successfully.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Create expense error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating expense.',
    });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/expenses/:id
// Update an expense (verify ownership)
// ─────────────────────────────────────────────────
router.put('/:id', validateIdParam, validateExpense, async (req, res) => {
  try {
    const userId = req.user.userId;
    const expenseId = req.params.id;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM expenses WHERE id = ? AND user_id = ?',
      [expenseId, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or access denied.',
      });
    }

    const { title, amount, category, expense_date, notes, currency } = req.body;

    await pool.query(
      `UPDATE expenses
       SET title = ?, amount = ?, category = ?, expense_date = ?, notes = ?, currency = ?
       WHERE id = ? AND user_id = ?`,
      [title, amount, category || 'other', expense_date, notes || null, currency || 'INR', expenseId, userId]
    );

    const [rows] = await pool.query('SELECT * FROM expenses WHERE id = ?', [expenseId]);

    return res.json({
      success: true,
      message: 'Expense updated successfully.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Update expense error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating expense.',
    });
  }
});

// ─────────────────────────────────────────────────
// DELETE /api/expenses/:id
// Delete an expense (verify ownership)
// ─────────────────────────────────────────────────
router.delete('/:id', validateIdParam, async (req, res) => {
  try {
    const userId = req.user.userId;
    const expenseId = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM expenses WHERE id = ? AND user_id = ?',
      [expenseId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or access denied.',
      });
    }

    return res.json({
      success: true,
      message: 'Expense deleted successfully.',
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting expense.',
    });
  }
});

module.exports = router;
