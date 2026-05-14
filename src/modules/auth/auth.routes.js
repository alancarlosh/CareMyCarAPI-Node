const express = require('express');
const asyncHandler = require('../../utils/async-handler');
const { tokenRequired } = require('../../middleware/auth');
const { validateEmail, validatePassword } = require('../../utils/validators');
const User = require('./user.repository');
const { createAccessToken } = require('./token.service');

const router = express.Router();

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const email = String(payload.email || '').trim().toLowerCase();
    const password = payload.password || '';
    const name = String(payload.name || '').trim() || null;

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }
    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Invalid password' });
    }

    if (await User.findByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const created = await User.createUser({ email, password, name });
    return res.status(201).json({ user: User.toPublic(created) });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const payload = req.body || {};
    const email = String(payload.email || '').trim().toLowerCase();
    const password = payload.password || '';

    const user = await User.findByEmail(email);
    if (!user || !(await User.verifyPassword(user, password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = createAccessToken(String(user._id));
    return res.status(200).json({ access_token: token, user: User.toPublic(user) });
  }),
);

router.get('/profile', tokenRequired, (req, res) => {
  return res.status(200).json({ user: User.toPublic(req.currentUser) });
});

module.exports = router;
