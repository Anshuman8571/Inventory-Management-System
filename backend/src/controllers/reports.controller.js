const reportsService = require('../services/reports.service');

// Single combined endpoint — the Reports view needs all three at once, and it's a small
// enough amount of data that three separate round-trips would just add latency for
// no benefit (see rules.md: avoid unnecessary complexity).
async function getSummary(req, res, next) {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;

    const [stockValue, topMovers, priceChanges] = await Promise.all([
      reportsService.getStockValueSummary(),
      reportsService.getTopMovers({ days }),
      reportsService.getRecentPriceChanges({ limit: 20 }),
    ]);

    res.json({ stockValue, topMovers, priceChanges, days });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSummary };