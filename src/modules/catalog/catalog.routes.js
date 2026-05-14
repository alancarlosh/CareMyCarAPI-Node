const express = require('express');

const asyncHandler = require('../../utils/async-handler');
const CatalogService = require('./catalog.service');
const VehicleCatalog = require('./vehicle-catalog.repository');

const router = express.Router();

router.post(
  '/vehicles/seed',
  asyncHandler(async (req, res) => {
    try {
      const result = await CatalogService.seedVehicles(req.body);
      return res.status(200).json(result);
    } catch (err) {
      if (err.statusCode) {
        return res.status(err.statusCode).json({ error: err.message });
      }
      throw err;
    }
  }),
);

router.get(
  '/vehicles',
  asyncHandler(async (_req, res) => {
    const items = await VehicleCatalog.findAll();
    return res.status(200).json({ items });
  }),
);

router.get(
  '/vehicles/:catalogId',
  asyncHandler(async (req, res) => {
    const item = await VehicleCatalog.findById(req.params.catalogId);
    if (!item) {
      return res.status(404).json({ error: 'Vehículo de catálogo no encontrado' });
    }

    return res.status(200).json({ item });
  }),
);

module.exports = router;
