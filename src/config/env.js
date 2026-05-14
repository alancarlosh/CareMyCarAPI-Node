require('dotenv').config();

const env = {
  port: Number(process.env.PORT || 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  secretKey: process.env.SECRET_KEY || 'dev-secret',
  jwtSecretKey: process.env.JWT_SECRET_KEY || 'dev-jwt-secret',
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  mongoDbName: process.env.MONGO_DB_NAME || 'vehicle_maintenance',
};

module.exports = env;
