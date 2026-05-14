const VehicleCatalog = require('../catalog/vehicle-catalog.repository');

async function applyCatalogVehicle(payload) {
  const nextPayload = payload || {};
  const catalogId = String(nextPayload.catalog_vehicle_id || '')
    .trim()
    .toLowerCase();

  if (!catalogId) {
    return { payload: nextPayload, error: null };
  }

  const catalogVehicle = await VehicleCatalog.findById(catalogId);
  if (!catalogVehicle) {
    return { payload: nextPayload, error: 'catalog_vehicle_id no encontrado en el catálogo' };
  }

  nextPayload.catalog_vehicle_id = catalogId;
  nextPayload.make = catalogVehicle.make;
  nextPayload.model = catalogVehicle.model;
  nextPayload.vehicle_type = catalogVehicle.vehicle_type;
  nextPayload.fuel_type = catalogVehicle.fuel_type;
  nextPayload.transmission = catalogVehicle.transmission;
  nextPayload.image_urls = catalogVehicle.image_urls || [];

  return { payload: nextPayload, error: null };
}

module.exports = {
  applyCatalogVehicle,
};
