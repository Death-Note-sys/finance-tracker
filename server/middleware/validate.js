const { body, query, param, validationResult } = require('express-validator');

// ──────────────────────────────────────────────
// Helper: run validation rules and return errors
// ──────────────────────────────────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({
        field: e.path,
        message: e.msg,
      })),
    });
  }
  next();
};

// ──────────────────────────────────────────────
// AUTH validators
// ──────────────────────────────────────────────
const validateRegister = [
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 2, max: 50 }).withMessage('Username must be 2-50 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors,
];

const validateLogin = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

const validateProfileUpdate = [
  body('preferred_currency')
    .trim()
    .notEmpty().withMessage('Preferred currency is required')
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code (e.g. INR, USD)'),
  handleValidationErrors,
];

// ──────────────────────────────────────────────
// EXPENSE validators
// ──────────────────────────────────────────────
const validateExpense = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title must be at most 200 characters'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('category')
    .optional()
    .isIn(['food', 'transport', 'utilities', 'entertainment', 'healthcare', 'education', 'shopping', 'rent', 'travel', 'other'])
    .withMessage('Invalid category'),
  body('expense_date')
    .notEmpty().withMessage('Expense date is required')
    .isISO8601().withMessage('Must be a valid date (YYYY-MM-DD)'),
  body('notes')
    .optional()
    .trim(),
  body('currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  handleValidationErrors,
];

const validateExpenseQuery = [
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
  query('category')
    .optional()
    .isIn(['food', 'transport', 'utilities', 'entertainment', 'healthcare', 'education', 'shopping', 'rent', 'travel', 'other'])
    .withMessage('Invalid category'),
  handleValidationErrors,
];

// ──────────────────────────────────────────────
// INCOME validators
// ──────────────────────────────────────────────
const validateIncome = [
  body('source_name')
    .trim()
    .notEmpty().withMessage('Source name is required')
    .isLength({ max: 200 }).withMessage('Source name must be at most 200 characters'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('frequency')
    .optional()
    .isIn(['one-time', 'daily', 'weekly', 'monthly', 'yearly'])
    .withMessage('Invalid frequency'),
  body('income_date')
    .notEmpty().withMessage('Income date is required')
    .isISO8601().withMessage('Must be a valid date (YYYY-MM-DD)'),
  body('notes')
    .optional()
    .trim(),
  body('currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  handleValidationErrors,
];

const validateIncomeQuery = [
  query('month')
    .optional()
    .isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 }).withMessage('Year must be between 2000 and 2100'),
  handleValidationErrors,
];

// ──────────────────────────────────────────────
// SAVINGS validators
// ──────────────────────────────────────────────
const validateSavingsGoal = [
  body('goal_name')
    .trim()
    .notEmpty().withMessage('Goal name is required')
    .isLength({ max: 200 }).withMessage('Goal name must be at most 200 characters'),
  body('target_amount')
    .notEmpty().withMessage('Target amount is required')
    .isFloat({ min: 0.01 }).withMessage('Target amount must be greater than 0'),
  body('deadline')
    .optional({ nullable: true })
    .isISO8601().withMessage('Must be a valid date (YYYY-MM-DD)'),
  body('notes')
    .optional()
    .trim(),
  body('currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  handleValidationErrors,
];

const validateAddFunds = [
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  handleValidationErrors,
];

// ──────────────────────────────────────────────
// BORROWING validators
// ──────────────────────────────────────────────
const validateBorrowing = [
  body('person_name')
    .trim()
    .notEmpty().withMessage('Person name is required')
    .isLength({ max: 200 }).withMessage('Person name must be at most 200 characters'),
  body('type')
    .notEmpty().withMessage('Type is required')
    .isIn(['lent', 'borrowed']).withMessage('Type must be "lent" or "borrowed"'),
  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('interest_rate')
    .optional()
    .isFloat({ min: 0, max: 100 }).withMessage('Interest rate must be between 0 and 100'),
  body('interest_type')
    .optional()
    .isIn(['none', 'simple', 'compound']).withMessage('Interest type must be none, simple, or compound'),
  body('borrow_date')
    .notEmpty().withMessage('Borrow date is required')
    .isISO8601().withMessage('Must be a valid date (YYYY-MM-DD)'),
  body('due_date')
    .optional({ nullable: true })
    .isISO8601().withMessage('Must be a valid date (YYYY-MM-DD)'),
  body('notes')
    .optional()
    .trim(),
  body('currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter code'),
  handleValidationErrors,
];

const validateSettle = [
  body('amount_to_settle')
    .notEmpty().withMessage('Settlement amount is required')
    .isFloat({ min: 0.01 }).withMessage('Settlement amount must be greater than 0'),
  handleValidationErrors,
];

// ──────────────────────────────────────────────
// Common param validator
// ──────────────────────────────────────────────
const validateIdParam = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID must be a positive integer'),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateProfileUpdate,
  validateExpense,
  validateExpenseQuery,
  validateIncome,
  validateIncomeQuery,
  validateSavingsGoal,
  validateAddFunds,
  validateBorrowing,
  validateSettle,
  validateIdParam,
};
