const express = require('express');
const { tokenRequired } = require('../../middleware/auth');

const router = express.Router();

router.use(tokenRequired);

router.post('/predict/:vehicleId', (_req, res) => {
  return res.status(501).json({ error: 'Predictions ML migration is planned for phase 2' });
});

router.get('/predictions/:vehicleId', (_req, res) => {
  return res.status(501).json({ error: 'Predictions ML migration is planned for phase 2' });
});

module.exports = router;
