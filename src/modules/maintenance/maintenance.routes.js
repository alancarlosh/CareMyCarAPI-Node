const express = require('express');

const { tokenRequired } = require('../../middleware/auth');
const asyncHandler = require('../../utils/async-handler');
const { isValidObjectId } = require('../../utils/object-id');
const { validateMaintenancePayload } = require('../../utils/validators');
const Maintenance = require('./maintenance.repository');
const MaintenanceDue = require('./maintenance-due.repository');
const MaintenanceService = require('./maintenance.service');
const Vehicle = require('../vehicles/vehicle.repository');

const router = express.Router();

router.use(tokenRequired);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const errors = validateMaintenancePayload(payload, false);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const vehicleId = payload.vehicle_id;
    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicle id' });
    }

    const userId = String(req.currentUser._id);
    const vehicle = await Vehicle.findByIdForUser(vehicleId, userId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const item = await Maintenance.create(userId, payload);
    await MaintenanceService.computeVehicleDue(req.currentUser, vehicle);
    return res.status(201).json({ maintenance: item });
  }),
);

router.get(
  '/insights/recommendations/:vehicleId',
  asyncHandler(async (req, res) => {
    const { vehicleId } = req.params;
    if (!isValidObjectId(vehicleId)) {
      return res.status(400).json({ error: 'Invalid vehicle id' });
    }

    const userId = String(req.currentUser._id);
    const vehicle = await Vehicle.findByIdForUser(vehicleId, userId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const payload = await MaintenanceService.computeVehicleDue(req.currentUser, vehicle);
    return res.status(200).json({ vehicle_id: vehicleId, recommendations: payload.items });
  }),
);

router.get(
  '/insights/upcoming',
  asyncHandler(async (req, res) => {
    const userId = String(req.currentUser._id);
    const vehicles = await Vehicle.findAllByUser(userId);

    for (const vehicle of vehicles) {
      await MaintenanceService.computeVehicleDue(req.currentUser, vehicle);
    }

    const rows = await MaintenanceDue.listDueByUser(userId);
    const dueOrUpcoming = rows.filter((row) => row.has_due || row.has_upcoming);
    return res.status(200).json({ items: dueOrUpcoming });
  }),
);

router.get(
  '/insights/upcoming/all',
  asyncHandler(async (req, res) => {
    if (String(req.currentUser.role || 'user').toLowerCase() !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const rows = await MaintenanceDue.listAllDue();
    const dueOrUpcoming = rows.filter((row) => row.has_due || row.has_upcoming);
    const items = await MaintenanceService.attachUserInfo(dueOrUpcoming);
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

    const userId = String(req.currentUser._id);
    const vehicle = await Vehicle.findByIdForUser(vehicleId, userId);
    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const items = await Maintenance.findByVehicle(userId, vehicleId);
    return res.status(200).json({ items });
  }),
);

router.put(
  '/:maintenanceId',
  asyncHandler(async (req, res) => {
    const { maintenanceId } = req.params;
    if (!isValidObjectId(maintenanceId)) {
      return res.status(400).json({ error: 'Invalid maintenance id' });
    }

    const payload = req.body || {};
    const errors = validateMaintenancePayload(payload, true);
    if (errors.length) {
      return res.status(400).json({ errors });
    }

    const userId = String(req.currentUser._id);
    const existing = await Maintenance.findByIdForUser(maintenanceId, userId);
    const item = await Maintenance.updateForUser(maintenanceId, userId, payload);
    if (!item) {
      return res.status(404).json({ error: 'Maintenance record not found or empty payload' });
    }

    if (existing) {
      const vehicle = await Vehicle.findByIdForUser(existing.vehicle_id, userId);
      if (vehicle) {
        await MaintenanceService.computeVehicleDue(req.currentUser, vehicle);
      }
    }

    return res.status(200).json({ maintenance: item });
  }),
);

router.delete(
  '/:maintenanceId',
  asyncHandler(async (req, res) => {
    const { maintenanceId } = req.params;
    if (!isValidObjectId(maintenanceId)) {
      return res.status(400).json({ error: 'Invalid maintenance id' });
    }

    const userId = String(req.currentUser._id);
    const existing = await Maintenance.findByIdForUser(maintenanceId, userId);
    const deleted = await Maintenance.deleteForUser(maintenanceId, userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    if (existing) {
      const vehicle = await Vehicle.findByIdForUser(existing.vehicle_id, userId);
      if (vehicle) {
        await MaintenanceService.computeVehicleDue(req.currentUser, vehicle);
      }
    }

    return res.status(200).json({ status: 'deleted' });
  }),
);

module.exports = router;
