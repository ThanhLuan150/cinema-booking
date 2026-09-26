// Thrown when a sale (or a pre-sale check) asks for more of a tracked F&B item than a branch has.
// `status`/`code` make middleware/errorHandler answer 409 { code: 'INSUFFICIENT_STOCK', ... }.
class InsufficientStockError extends Error {
  // shortages: [{ combo_id, inventory_id, item, requested, available }]
  constructor(shortages) {
    const first = shortages[0] || {};
    super(`Insufficient stock for ${first.item || 'item'}: requested ${first.requested}, available ${first.available}`);
    this.name = 'InsufficientStockError';
    this.status = 409;
    this.code = 'INSUFFICIENT_STOCK';
    this.shortages = shortages;
  }
}

module.exports = InsufficientStockError;
