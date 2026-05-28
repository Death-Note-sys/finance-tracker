import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';

/**
 * Format a date string to a readable format.
 */
export function formatDate(dateStr, pattern = 'dd MMM yyyy') {
  if (!dateStr) return '—';
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (!isValid(date)) return '—';
  return format(date, pattern);
}

/**
 * Get relative time string (e.g., "2 days ago").
 */
export function getRelativeTime(dateStr) {
  if (!dateStr) return '';
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (!isValid(date)) return '';
  return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Get the number of days between now and a future date.
 */
export function getDaysRemaining(dateStr) {
  if (!dateStr) return null;
  const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
  if (!isValid(date)) return null;
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Category color mapping for expenses.
 */
const CATEGORY_COLORS = {
  food: '#f59e0b',
  transport: '#3b82f6',
  housing: '#8b5cf6',
  utilities: '#06b6d4',
  entertainment: '#ec4899',
  healthcare: '#10b981',
  education: '#6366f1',
  shopping: '#f97316',
  travel: '#14b8a6',
  personal: '#a78bfa',
  groceries: '#84cc16',
  subscriptions: '#e879f9',
  insurance: '#64748b',
  other: '#94a3b8',
};

export function getCategoryColor(category) {
  if (!category) return CATEGORY_COLORS.other;
  return CATEGORY_COLORS[category.toLowerCase()] || CATEGORY_COLORS.other;
}

/**
 * Category icon mapping.
 */
const CATEGORY_ICONS = {
  food: '🍔',
  transport: '🚗',
  housing: '🏠',
  utilities: '💡',
  entertainment: '🎬',
  healthcare: '🏥',
  education: '📚',
  shopping: '🛍️',
  travel: '✈️',
  personal: '👤',
  groceries: '🛒',
  subscriptions: '📱',
  insurance: '🛡️',
  other: '📦',
};

export function getCategoryIcon(category) {
  if (!category) return CATEGORY_ICONS.other;
  return CATEGORY_ICONS[category.toLowerCase()] || CATEGORY_ICONS.other;
}

/**
 * Get urgency color based on days remaining.
 */
export function getUrgencyColor(daysRemaining) {
  if (daysRemaining === null || daysRemaining === undefined) return 'neutral';
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 7) return 'critical';
  if (daysRemaining <= 30) return 'warning';
  return 'safe';
}

/**
 * Get urgency CSS class.
 */
export function getUrgencyClass(daysRemaining) {
  const urgency = getUrgencyColor(daysRemaining);
  const map = {
    safe: 'badge-success',
    warning: 'badge-warning',
    critical: 'badge-danger',
    overdue: 'badge-danger',
    neutral: 'badge-neutral',
  };
  return map[urgency] || 'badge-neutral';
}

/**
 * Get status badge class.
 */
export function getStatusBadge(status) {
  const map = {
    active: 'badge-info',
    completed: 'badge-success',
    cancelled: 'badge-neutral',
    pending: 'badge-warning',
    partial: 'badge-primary',
    settled: 'badge-success',
    overdue: 'badge-danger',
  };
  return map[(status || '').toLowerCase()] || 'badge-neutral';
}

/**
 * List of expense categories.
 */
export const EXPENSE_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Education',
  'Shopping',
  'Travel',
  'Personal',
  'Groceries',
  'Subscriptions',
  'Insurance',
  'Other',
];

/**
 * List of income frequencies.
 */
export const INCOME_FREQUENCIES = [
  { value: 'one-time', label: 'One-Time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

/**
 * Get frequency badge class.
 */
export function getFrequencyBadge(frequency) {
  const map = {
    'one-time': 'badge-neutral',
    daily: 'badge-info',
    weekly: 'badge-primary',
    monthly: 'badge-success',
    yearly: 'badge-warning',
  };
  return map[(frequency || '').toLowerCase()] || 'badge-neutral';
}

/**
 * Calculate simple/compound interest.
 */
export function calculateInterest(principal, rate, days, type = 'simple') {
  if (!rate || !days || days <= 0) return 0;
  const years = days / 365;
  if (type === 'compound') {
    return principal * Math.pow(1 + rate / 100, years) - principal;
  }
  return (principal * rate * years) / 100;
}
