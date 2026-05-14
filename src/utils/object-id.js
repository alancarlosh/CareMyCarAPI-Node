const { ObjectId } = require('mongodb');

function isValidObjectId(value) {
  return ObjectId.isValid(value);
}

function toObjectId(value) {
  return new ObjectId(value);
}

function serializeDocument(doc) {
  if (!doc) {
    return null;
  }

  const serialized = { ...doc, id: String(doc._id) };
  delete serialized._id;
  return serialized;
}

module.exports = {
  isValidObjectId,
  toObjectId,
  serializeDocument,
};
