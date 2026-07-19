// Compares a newly-seen price against a product's last known price, and — when given a
// transaction client — records the change to price_history and updates
// products.last_known_price. Used both for display (at bill upload/review time, no
// client passed, nothing persisted) and for actually recording (at confirm time).

const priceHistoryModel = require('../models/priceHistory.model');
const productsModel = require('../models/products.model');

function compare(previousPrice, newPrice) {
  if (newPrice == null) {
    return { previousPrice: previousPrice ?? null, newPrice: null, changeType: 'unknown' };
  }
  if (previousPrice == null) {
    return { previousPrice: null, newPrice: Number(newPrice), changeType: 'first' };
  }
  const prev = Number(previousPrice);
  const next = Number(newPrice);
  if (next > prev) return { previousPrice: prev, newPrice: next, changeType: 'increase' };
  if (next < prev) return { previousPrice: prev, newPrice: next, changeType: 'decrease' };
  return { previousPrice: prev, newPrice: next, changeType: 'same' };
}

// Actually persists the new price — called during bill confirmation, inside the same
// transaction as the stock update, so price and stock never get out of sync with
// each other if something fails partway through.
async function recordPrice({ productId, newPrice, billId, tradeDiscount, schemeDiscount, gstPercent, client }) {
  if (newPrice == null) return; // nothing to record if price wasn't legible on the bill

  await priceHistoryModel.create({ productId, price: newPrice, billId, tradeDiscount, schemeDiscount, gstPercent }, client);
  await productsModel.updatePrice(productId, newPrice, client);
}

module.exports = { compare, recordPrice };