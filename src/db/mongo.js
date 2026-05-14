const { MongoClient } = require('mongodb');
const env = require('../config/env');

let client;
let db;

async function connectDb() {
  if (db) {
    return db;
  }

  client = new MongoClient(env.mongoUri);
  await client.connect();
  db = client.db(env.mongoDbName);
  return db;
}

function getDb() {
  if (!db) {
    throw new Error('MongoDB is not connected');
  }
  return db;
}

async function closeDb() {
  if (client) {
    await client.close();
  }
  client = undefined;
  db = undefined;
}

module.exports = {
  connectDb,
  getDb,
  closeDb,
};
