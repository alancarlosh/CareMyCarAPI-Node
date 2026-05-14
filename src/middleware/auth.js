const { decodeToken } = require('../modules/auth/token.service');
const User = require('../modules/auth/user.repository');

async function tokenRequired(req, res, next) {
  const authHeader = req.get('Authorization') || '';
  const parts = authHeader.split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({ error: 'Token faltante o inválido' });
  }

  const userId = decodeToken(parts[1]);
  if (!userId) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  req.currentUser = user;
  return next();
}

module.exports = {
  tokenRequired,
};
