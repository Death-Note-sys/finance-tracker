const express = require('express');
const { pool } = require('../config/db');
const authenticate = require('../middleware/auth');
const {
  validateSavingsGoal,
  validateAddFunds,
  validateIdParam,
} = require('../middleware/validate');

const router = express.Router();

// All savings routes are protected
router.use(authenticate);

// ─────────────────────────────────────────────────
// GET /api/savings
// List all savings goals for the current user
// ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [rows] = await pool.query(
      `SELECT *,
         ROUND((current_amount / target_amount) * 100, 2) AS progress_percentage
       FROM savings_goals
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [userId]
    );

    return res.json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error('Get savings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching savings goals.',
    });
  }
});

// ─────────────────────────────────────────────────
// POST /api/savings
// Create a new savings goal
// ─────────────────────────────────────────────────
router.post('/', validateSavingsGoal, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { goal_name, target_amount, deadline, notes, currency } = req.body;

    const [result] = await pool.query(
      `INSERT INTO savings_goals (user_id, goal_name, target_amount, deadline, notes, currency)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, goal_name, target_amount, deadline || null, notes || null, currency || 'INR']
    );

    const [rows] = await pool.query('SELECT * FROM savings_goals WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Savings goal created successfully.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Create savings goal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating savings goal.',
    });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/savings/:id
// Update a savings goal (verify ownership)
// Auto-set status to 'completed' if current_amount >= target_amount
// ─────────────────────────────────────────────────
router.put('/:id', validateIdParam, validateSavingsGoal, async (req, res) => {
  try {
    const userId = req.user.userId;
    const goalId = req.params.id;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT * FROM savings_goals WHERE id = ? AND user_id = ?',
      [goalId, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Savings goal not found or access denied.',
      });
    }

    const { goal_name, target_amount, deadline, notes, currency } = req.body;

    // Determine status: auto-complete if current savings meet/exceed target
    const currentAmount = parseFloat(existing[0].current_amount);
    const newTarget = parseFloat(target_amount);
    let status = existing[0].status;
    if (currentAmount >= newTarget) {
      status = 'completed';
    }

    await pool.query(
      `UPDATE savings_goals
       SET goal_name = ?, target_amount = ?, deadline = ?, notes = ?, currency = ?, status = ?
       WHERE id = ? AND user_id = ?`,
      [goal_name, target_amount, deadline || null, notes || null, currency || 'INR', status, goalId, userId]
    );

    const [rows] = await pool.query('SELECT * FROM savings_goals WHERE id = ?', [goalId]);

    return res.json({
      success: true,
      message: 'Savings goal updated successfully.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Update savings goal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating savings goal.',
    });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/savings/:id/add-funds
// Add funds to a savings goal (increment current_amount)
// Auto-set status to 'completed' if threshold is met
// ─────────────────────────────────────────────────
router.put('/:id/add-funds', validateIdParam, validateAddFunds, async (req, res) => {
  try {
    const userId = req.user.userId;
    const goalId = req.params.id;
    const { amount } = req.body;

    // Verify ownership and fetch current data
    const [existing] = await pool.query(
      'SELECT * FROM savings_goals WHERE id = ? AND user_id = ?',
      [goalId, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Savings goal not found or access denied.',
      });
    }

    const goal = existing[0];

    if (goal.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This savings goal is already completed.',
      });
    }
    if (goal.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot add funds to a cancelled goal.',
      });
    }

    const newAmount = parseFloat(goal.current_amount) + parseFloat(amount);
    const targetAmount = parseFloat(goal.target_amount);
    const newStatus = newAmount >= targetAmount ? 'completed' : 'active';

    await pool.query(
      'UPDATE savings_goals SET current_amount = ?, status = ? WHERE id = ?',
      [newAmount.toFixed(2), newStatus, goalId]
    );

    const [rows] = await pool.query('SELECT * FROM savings_goals WHERE id = ?', [goalId]);

    return res.json({
      success: true,
      message:
        newStatus === 'completed'
          ? '🎉 Congratulations! Savings goal completed!'
          : 'Funds added successfully.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Add funds error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while adding funds.',
    });
  }
});

// ─────────────────────────────────────────────────
// DELETE /api/savings/:id
// Delete a savings goal (verify ownership)
// ─────────────────────────────────────────────────
router.delete('/:id', validateIdParam, async (req, res) => {
  try {
    const userId = req.user.userId;
    const goalId = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM savings_goals WHERE id = ? AND user_id = ?',
      [goalId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Savings goal not found or access denied.',
      });
    }

    return res.json({
      success: true,
      message: 'Savings goal deleted successfully.',
    });
  } catch (error) {
    console.error('Delete savings goal error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting savings goal.',
    });
  }
});

module.exports = router;
