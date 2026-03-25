function ensureArray(data, context = 'unknown') {
  if (!Array.isArray(data)) {
    console.warn(`[ensureArray] Invalid array detected in ${context}, resetting:`, data);
    return [];
  }
  return data;
}

module.exports = ensureArray;
