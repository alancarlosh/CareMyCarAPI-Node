const jwt = require('jsonwebtoken');
const env = require('../../config/env');

function createAccessToken(userId) {
  return jwt.sign(
    {
      sub: userId,
      type: 'access',
    },
    env.jwtSecretKey,
    { algorithm: 'HS256', expiresIn: '6h' },
  );
}

function decodeToken(token) {
  try {
    const payload = jwt.verify(token, env.jwtSecretKey, { algorithms: ['HS256'] });
    return payload.sub;
  } catch {
    return null;
  }
}

module.exports = {
  createAccessToken,
  decodeToken,
};
