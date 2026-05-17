const express = require('express');
const cors = require('cors');

const authRoutes = require('./modules/auth/auth.routes');
const catalogRoutes = require('./modules/catalog/catalog.routes');
const vehiclesRoutes = require('./modules/vehicles/vehicles.routes');
const maintenanceRoutes = require('./modules/maintenance/maintenance.routes');
const partsRoutes = require('./modules/parts/parts.routes');
const ordersRoutes = require('./modules/orders/orders.routes');
const serviceOrdersRoutes = require('./modules/service-orders/service-orders.routes');
const predictionsRoutes = require('./modules/predictions/predictions.routes');
const toolsRoutes = require('./modules/tools/tools.routes');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    return res.status(200).json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/vehicles', vehiclesRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/parts', partsRoutes);
  app.use('/api/orders', ordersRoutes);
  app.use('/api/service-orders', serviceOrdersRoutes);
  app.use('/api/tools', toolsRoutes);
  app.use('/api', predictionsRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
