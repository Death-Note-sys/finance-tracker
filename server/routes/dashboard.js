const express = require('express');
const { pool } = require('../config/db');
const authenticate = require('../middleware/auth');

const router = express.Router();

// All dashboard routes are protected
router.use(authenticate);

// ─────────────────────────────────────────────────
// GET /api/dashboard/summary
// Current-month totals: income, expenses, net, savings, lent, borrowed
// ─────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Total income this month
    const [incomeRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM income_sources
       WHERE user_id = ? AND MONTH(income_date) = ? AND YEAR(income_date) = ?`,
      [userId, currentMonth, currentYear]
    );

    // Total expenses this month
    const [expenseRows] = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE user_id = ? AND MONTH(expense_date) = ? AND YEAR(expense_date) = ?`,
      [userId, currentMonth, currentYear]
    );

    // Total savings (sum of current_amount across all active/completed goals)
    const [savingsRows] = await pool.query(
      `SELECT COALESCE(SUM(current_amount), 0) AS total
       FROM savings_goals
       WHERE user_id = ?`,
      [userId]
    );

    // Total lent (outstanding)
    const [lentRows] = await pool.query(
      `SELECT COALESCE(SUM(amount - amount_settled), 0) AS total
       FROM borrowings
       WHERE user_id = ? AND type = 'lent' AND status != 'settled'`,
      [userId]
    );

    // Total borrowed (outstanding)
    const [borrowedRows] = await pool.query(
      `SELECT COALESCE(SUM(amount - amount_settled), 0) AS total
       FROM borrowings
       WHERE user_id = ? AND type = 'borrowed' AND status != 'settled'`,
      [userId]
    );

    const totalIncome = parseFloat(incomeRows[0].total);
    const totalExpenses = parseFloat(expenseRows[0].total);

    return res.json({
      success: true,
      data: {
        month: currentMonth,
        year: currentYear,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        net_balance: parseFloat((totalIncome - totalExpenses - parseFloat(savingsRows[0].total) - parseFloat(lentRows[0].total) + parseFloat(borrowedRows[0].total)).toFixed(2)),
        total_savings: parseFloat(savingsRows[0].total),
        total_lent: parseFloat(lentRows[0].total),
        total_borrowed: parseFloat(borrowedRows[0].total),
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard summary.',
    });
  }
});

// ─────────────────────────────────────────────────
// GET /api/dashboard/monthly-trend
// Last 6 months of income vs expenses (for line chart)
// ─────────────────────────────────────────────────
router.get('/monthly-trend', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Build the last 6 months (including current)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        month: d.getMonth() + 1,
        year: d.getFullYear(),
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
      });
    }

    // Fetch income aggregated by month
    const [incomeData] = await pool.query(
      `SELECT MONTH(income_date) AS m, YEAR(income_date) AS y, SUM(amount) AS total
       FROM income_sources
       WHERE user_id = ?
         AND income_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY y, m`,
      [userId]
    );

    // Fetch expenses aggregated by month
    const [expenseData] = await pool.query(
      `SELECT MONTH(expense_date) AS m, YEAR(expense_date) AS y, SUM(amount) AS total
       FROM expenses
       WHERE user_id = ?
         AND expense_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY y, m`,
      [userId]
    );

    // Map results to each month
    const trend = months.map((monthObj) => {
      const incomeEntry = incomeData.find(
        (r) => r.m === monthObj.month && r.y === monthObj.year
      );
      const expenseEntry = expenseData.find(
        (r) => r.m === monthObj.month && r.y === monthObj.year
      );

      return {
        month: monthObj.month,
        year: monthObj.year,
        label: monthObj.label,
        income: parseFloat(incomeEntry?.total || 0),
        expenses: parseFloat(expenseEntry?.total || 0),
      };
    });

    return res.json({
      success: true,
      data: trend,
    });
  } catch (error) {
    console.error('Monthly trend error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching monthly trend.',
    });
  }
});

// ─────────────────────────────────────────────────
// GET /api/dashboard/reminders
// Upcoming due dates (next 30 days) and overdue borrowings
// ─────────────────────────────────────────────────
router.get('/reminders', async (req, res) => {
  try {
    const userId = req.user.userId;

    // Overdue borrowings (past due_date and not settled)
    const [overdue] = await pool.query(
      `SELECT id, person_name, type, amount, amount_settled, due_date, status
       FROM borrowings
       WHERE user_id = ?
         AND due_date < CURDATE()
         AND status != 'settled'
       ORDER BY due_date ASC`,
      [userId]
    );

    // Upcoming (due within next 30 days, not settled)
    const [upcoming] = await pool.query(
      `SELECT id, person_name, type, amount, amount_settled, due_date, status
       FROM borrowings
       WHERE user_id = ?
         AND due_date >= CURDATE()
         AND due_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
         AND status != 'settled'
       ORDER BY due_date ASC`,
      [userId]
    );

    // Savings goals nearing deadline (within 30 days, still active)
    const [savingsDeadlines] = await pool.query(
      `SELECT id, goal_name, target_amount, current_amount, deadline
       FROM savings_goals
       WHERE user_id = ?
         AND deadline IS NOT NULL
         AND deadline >= CURDATE()
         AND deadline <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
         AND status = 'active'
       ORDER BY deadline ASC`,
      [userId]
    );

    return res.json({
      success: true,
      data: {
        overdue_borrowings: overdue,
        upcoming_borrowings: upcoming,
        savings_deadlines: savingsDeadlines,
      },
    });
  } catch (error) {
    console.error('Reminders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching reminders.',
    });
  }
});

module.exports = router;
