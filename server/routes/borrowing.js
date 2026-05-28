const express = require('express');
const { pool } = require('../config/db');
const authenticate = require('../middleware/auth');
const {
  validateBorrowing,
  validateSettle,
  validateIdParam,
} = require('../middleware/validate');

const router = express.Router();

// All borrowing routes are protected
router.use(authenticate);

// ─────────────────────────────────────────────────
// Helper: compute interest accrued for a borrowing record
// ─────────────────────────────────────────────────
function computeInterest(record) {
  const principal = parseFloat(record.amount);
  const rate = parseFloat(record.interest_rate);
  const interestType = record.interest_type;

  if (interestType === 'none' || rate === 0) {
    return 0;
  }

  const borrowDate = new Date(record.borrow_date);
  const now = new Date();
  const daysElapsed = Math.max(0, (now - borrowDate) / (1000 * 60 * 60 * 24));

  if (interestType === 'simple') {
    // Simple interest: P * r/100 * (days / 365)
    return principal * (rate / 100) * (daysElapsed / 365);
  }

  if (interestType === 'compound') {
    // Compound interest (annual compounding): P * ((1 + r/100)^(days/365) - 1)
    return principal * (Math.pow(1 + rate / 100, daysElapsed / 365) - 1);
  }

  return 0;
}

// ─────────────────────────────────────────────────
// Helper: compute urgency level based on due_date
// ─────────────────────────────────────────────────
function computeUrgency(record) {
  if (!record.due_date || record.status === 'settled') {
    return 'none';
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const dueDate = new Date(record.due_date);
  dueDate.setHours(0, 0, 0, 0);

  const daysRemaining = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining < 7) return 'critical';
  if (daysRemaining <= 30) return 'warning';
  return 'safe';
}

// ─────────────────────────────────────────────────
// Helper: enrich a borrowing row with computed fields
// ─────────────────────────────────────────────────
function enrichBorrowing(row) {
  const interestAccrued = computeInterest(row);
  const principal = parseFloat(row.amount);
  const settled = parseFloat(row.amount_settled);
  const totalDue = principal + interestAccrued - settled;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let daysRemaining = null;
  if (row.due_date) {
    const dueDate = new Date(row.due_date);
    dueDate.setHours(0, 0, 0, 0);
    daysRemaining = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
  }

  return {
    ...row,
    interest_accrued: parseFloat(interestAccrued.toFixed(2)),
    total_due: parseFloat(Math.max(0, totalDue).toFixed(2)),
    days_remaining: daysRemaining,
    urgency_level: computeUrgency(row),
  };
}

// ─────────────────────────────────────────────────
// GET /api/borrowings
// List all borrowings with computed fields
// ─────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [rows] = await pool.query(
      'SELECT * FROM borrowings WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );

    const enriched = rows.map(enrichBorrowing);

    return res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error('Get borrowings error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching borrowings.',
    });
  }
});

// ─────────────────────────────────────────────────
// GET /api/borrowings/summary
// Aggregated summary: total_lent, total_borrowed, net_balance, overdue_count, upcoming_count
// ─────────────────────────────────────────────────
router.get('/summary', async (req, res) => {
  try {
    const userId = req.user.userId;

    const [rows] = await pool.query(
      'SELECT * FROM borrowings WHERE user_id = ?',
      [userId]
    );

    let totalLent = 0;
    let totalBorrowed = 0;
    let overdueCount = 0;
    let upcomingCount = 0; // due within next 30 days

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    rows.forEach((row) => {
      const outstanding = parseFloat(row.amount) - parseFloat(row.amount_settled);

      if (row.type === 'lent') {
        totalLent += outstanding;
      } else {
        totalBorrowed += outstanding;
      }

      if (row.due_date && row.status !== 'settled') {
        const dueDate = new Date(row.due_date);
        dueDate.setHours(0, 0, 0, 0);
        const daysRemaining = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
          overdueCount++;
        } else if (daysRemaining <= 30) {
          upcomingCount++;
        }
      }
    });

    return res.json({
      success: true,
      data: {
        total_lent: parseFloat(totalLent.toFixed(2)),
        total_borrowed: parseFloat(totalBorrowed.toFixed(2)),
        net_balance: parseFloat((totalLent - totalBorrowed).toFixed(2)),
        overdue_count: overdueCount,
        upcoming_count: upcomingCount,
      },
    });
  } catch (error) {
    console.error('Borrowing summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching borrowing summary.',
    });
  }
});

// ─────────────────────────────────────────────────
// POST /api/borrowings
// Create a new borrowing/lending record
// ─────────────────────────────────────────────────
router.post('/', validateBorrowing, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      person_name, type, amount, interest_rate, interest_type,
      borrow_date, due_date, notes, currency,
    } = req.body;

    const [result] = await pool.query(
      `INSERT INTO borrowings
        (user_id, person_name, type, amount, interest_rate, interest_type, borrow_date, due_date, notes, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId, person_name, type, amount,
        interest_rate || 0, interest_type || 'none',
        borrow_date, due_date || null, notes || null, currency || 'INR',
      ]
    );

    const [rows] = await pool.query('SELECT * FROM borrowings WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Borrowing record created successfully.',
      data: enrichBorrowing(rows[0]),
    });
  } catch (error) {
    console.error('Create borrowing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while creating borrowing record.',
    });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/borrowings/:id
// Update a borrowing record (verify ownership)
// ─────────────────────────────────────────────────
router.put('/:id', validateIdParam, validateBorrowing, async (req, res) => {
  try {
    const userId = req.user.userId;
    const borrowId = req.params.id;

    // Verify ownership
    const [existing] = await pool.query(
      'SELECT id FROM borrowings WHERE id = ? AND user_id = ?',
      [borrowId, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Borrowing record not found or access denied.',
      });
    }

    const {
      person_name, type, amount, interest_rate, interest_type,
      borrow_date, due_date, notes, currency,
    } = req.body;

    await pool.query(
      `UPDATE borrowings
       SET person_name = ?, type = ?, amount = ?, interest_rate = ?, interest_type = ?,
           borrow_date = ?, due_date = ?, notes = ?, currency = ?
       WHERE id = ? AND user_id = ?`,
      [
        person_name, type, amount,
        interest_rate || 0, interest_type || 'none',
        borrow_date, due_date || null, notes || null, currency || 'INR',
        borrowId, userId,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM borrowings WHERE id = ?', [borrowId]);

    return res.json({
      success: true,
      message: 'Borrowing record updated successfully.',
      data: enrichBorrowing(rows[0]),
    });
  } catch (error) {
    console.error('Update borrowing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while updating borrowing record.',
    });
  }
});

// ─────────────────────────────────────────────────
// PUT /api/borrowings/:id/settle
// Settle (partially or fully) a borrowing
// ─────────────────────────────────────────────────
router.put('/:id/settle', validateIdParam, validateSettle, async (req, res) => {
  try {
    const userId = req.user.userId;
    const borrowId = req.params.id;
    const { amount_to_settle } = req.body;

    // Verify ownership and fetch current record
    const [existing] = await pool.query(
      'SELECT * FROM borrowings WHERE id = ? AND user_id = ?',
      [borrowId, userId]
    );
    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Borrowing record not found or access denied.',
      });
    }

    const record = existing[0];

    if (record.status === 'settled') {
      return res.status(400).json({
        success: false,
        message: 'This borrowing is already fully settled.',
      });
    }

    const currentSettled = parseFloat(record.amount_settled);
    const principal = parseFloat(record.amount);
    const newSettled = currentSettled + parseFloat(amount_to_settle);

    // Determine new status
    let newStatus;
    if (newSettled >= principal) {
      newStatus = 'settled';
    } else {
      newStatus = 'partial';
    }

    await pool.query(
      'UPDATE borrowings SET amount_settled = ?, status = ? WHERE id = ?',
      [Math.min(newSettled, principal).toFixed(2), newStatus, borrowId]
    );

    const [rows] = await pool.query('SELECT * FROM borrowings WHERE id = ?', [borrowId]);

    return res.json({
      success: true,
      message:
        newStatus === 'settled'
          ? 'Borrowing fully settled!'
          : 'Partial settlement recorded.',
      data: enrichBorrowing(rows[0]),
    });
  } catch (error) {
    console.error('Settle borrowing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while settling borrowing.',
    });
  }
});

// ─────────────────────────────────────────────────
// DELETE /api/borrowings/:id
// Delete a borrowing record (verify ownership)
// ─────────────────────────────────────────────────
router.delete('/:id', validateIdParam, async (req, res) => {
  try {
    const userId = req.user.userId;
    const borrowId = req.params.id;

    const [result] = await pool.query(
      'DELETE FROM borrowings WHERE id = ? AND user_id = ?',
      [borrowId, userId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Borrowing record not found or access denied.',
      });
    }

    return res.json({
      success: true,
      message: 'Borrowing record deleted successfully.',
    });
  } catch (error) {
    console.error('Delete borrowing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while deleting borrowing record.',
    });
  }
});

module.exports = router;
