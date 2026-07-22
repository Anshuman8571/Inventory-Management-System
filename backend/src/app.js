const express = require('express');
const cors = require('cors');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' })); // generous limit since scan photos are sent as base64

// Health check — used to verify the container/DB connection is alive.
// We support both /health and /healthz since Render defaults to /healthz.
app.get(['/health', '/healthz'], (req, res) => {
  res.json({ status: 'ok' });
});

// Route modules, mounted as they're built, phase by phase:
app.use('/auth', require('./routes/auth.routes'));
app.use('/categories', require('./routes/categories.routes'));
app.use('/scan', require('./routes/scan.routes'));
app.use('/products', require('./routes/products.routes'));
app.use('/bills', require('./routes/bills.routes'));
app.use('/reports', require('./routes/reports.routes'));

// 404 handler for anything not matched above
app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found', code: 'NOT_FOUND' } });
});

// Must be registered last — Express identifies error-handling middleware by its 4 arguments.
app.use(errorHandler);

module.exports = app;