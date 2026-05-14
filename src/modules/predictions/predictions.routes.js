const express = require('express');
const { tokenRequired } = require('../../middleware/auth');

const router = express.Router();

router.use(tokenRequired);

router.post('/predict/:vehicleId', (_req, res) => {
  return res.status(501).json({ error: 'La migración de ML de predicciones está planeada para la fase 2' });
});

router.get('/predictions/:vehicleId', (_req, res) => {
  return res.status(501).json({ error: 'La migración de ML de predicciones está planeada para la fase 2' });
});

module.exports = router;
