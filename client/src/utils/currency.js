// Currency configurations
const CURRENCIES = {
  INR: { symbol: '₹', locale: 'en-IN', code: 'INR', name: 'Indian Rupee' },
  USD: { symbol: '$', locale: 'en-US', code: 'USD', name: 'US Dollar' },
  EUR: { symbol: '€', locale: 'de-DE', code: 'EUR', name: 'Euro' },
  GBP: { symbol: '£', locale: 'en-GB', code: 'GBP', name: 'British Pound' },
  JPY: { symbol: '¥', locale: 'ja-JP', code: 'JPY', name: 'Japanese Yen' },
  AUD: { symbol: 'A$', locale: 'en-AU', code: 'AUD', name: 'Australian Dollar' },
  CAD: { symbol: 'C$', locale: 'en-CA', code: 'CAD', name: 'Canadian Dollar' },
};

// Static exchange rates relative to 1 INR
const EXCHANGE_RATES_FROM_INR = {
  INR: 1,
  USD: 0.012,
  EUR: 0.011,
  GBP: 0.0095,
  JPY: 1.82,
  AUD: 0.018,
  CAD: 0.016,
};

/**
 * Format an amount as a currency string.
 * @param {number} amount - The amount to format.
 * @param {string} currencyCode - Currency code (default: 'INR').
 * @returns {string} Formatted currency string.
 */
export function formatCurrency(amount, currencyCode = 'INR') {
  const config = CURRENCIES[currencyCode] || CURRENCIES.INR;
  try {
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: config.code === 'JPY' ? 0 : 2,
      maximumFractionDigits: config.code === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${config.symbol}${Number(amount).toLocaleString()}`;
  }
}

/**
 * Convert an amount between two currencies.
 * @param {number} amount - Amount in the source currency.
 * @param {string} fromCurrency - Source currency code.
 * @param {string} toCurrency - Target currency code.
 * @returns {number} Converted amount.
 */
export function convertCurrency(amount, fromCurrency = 'INR', toCurrency = 'INR') {
  if (fromCurrency === toCurrency) return amount;
  // Convert to INR first, then to target
  const amountInINR = amount / (EXCHANGE_RATES_FROM_INR[fromCurrency] || 1);
  return amountInINR * (EXCHANGE_RATES_FROM_INR[toCurrency] || 1);
}

/**
 * Get all available currencies as an array.
 */
export function getCurrencies() {
  return Object.values(CURRENCIES);
}

/**
 * Get a specific currency config.
 */
export function getCurrencyConfig(code = 'INR') {
  return CURRENCIES[code] || CURRENCIES.INR;
}

export default CURRENCIES;
