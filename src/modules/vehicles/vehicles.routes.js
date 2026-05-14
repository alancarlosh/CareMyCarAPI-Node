const express = require('express');

const { tokenRequired } = require('../../middleware/auth');
const asyncHandler = require('../../utils/async-handler');
const { isValidObjectId } = require('../../utils/object-id');
const { validateVehiclePayload } = require('../../utils/validators');
const Vehicle = require('./vehicle.repository');
const VehicleService = require('./vehicle.service');

const router = express.Router();

router.use(tokenRequired);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const applied = await VehicleService.applyCatalogVehicle(payload);

    if (applied.error) {
      return res.status(400).json({ error: applied.error });
    }

    const errors = validateVehiclePayload(applied.payload, false);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const vehicle = await Vehicle.create(String(req.currentUser._id), applied.payload);
    return res.status(201).json({ vehicle });
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const items = await Vehicle.findAllByUser(String(req.currentUser._id));
    return res.status(200).json({ items });
  }),
);

router.get(
  '/:vehicleId',
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicle id' });
    }

    const vehicle = await Vehicle.findByIdForUser(vehicleId, String(req.currentUser._id));
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    return res.status(200).json({ vehicle });
  }),
);

router.put(
  '/:vehicleId',
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicle id' });
    }

    const payload = req.body || {};
    const applied = await VehicleService.applyCatalogVehicle(payload);

    if (applied.error) {
      return res.status(400).json({ error: applied.error });
    }

    const errors = validateVehiclePayload(applied.payload, true);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const vehicle = await Vehicle.updateForUser(vehicleId, String(req.currentUser._id), applied.payload);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found or empty payload' });
    }

    return res.status(200).json({ vehicle });
  }),
);

router.delete(
  '/:vehicleId',
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicle id' });
    }

    const deleted = await Vehicle.deleteForUser(vehicleId, String(req.currentUser._id));
    if (!deleted) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    return res.status(200).json({ status: 'deleted' });
  }),
);

module.exports = router;
