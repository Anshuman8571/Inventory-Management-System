const productsModel = require('../models/products.model');

async function getProducts(req, res, next) {
  try {
    const products = await productsModel.list();
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProducts };
