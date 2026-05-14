const bcrypt = require('bcryptjs');
const { getDb } = require('../../db/mongo');
const { isValidObjectId, toObjectId } = require('../../utils/object-id');

function usersCollection() {
  return getDb().collection('users');
}

function toPublic(user) {
  if (!user) {
    return null;
  }

  return {
    id: String(user._id),
    email: user.email,
    name: user.name || null,
    role: user.role || 'user',
    created_at: user.created_at instanceof Date ? user.created_at.toISOString() : user.created_at || null,
  };
}

async function findByEmail(email) {
  return usersCollection().findOne({ email });
}

async function findById(userId) {
  if (!isValidObjectId(userId)) {
    return null;
  }
  return usersCollection().findOne({ _id: toObjectId(userId) });
}

async function createUser({ email, password, name }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const doc = {
    email,
    password_hash: passwordHash,
    name: name || null,
    role: 'user',
    created_at: new Date(),
    updated_at: new Date(),
  };
  const result = await usersCollection().insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

async function verifyPassword(user, password) {
  return bcrypt.compare(password, user.password_hash || '');
}

module.exports = {
  createUser,
  findByEmail,
  findById,
  toPublic,
  verifyPassword,
};
