const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'tourist_safety';
let client; let db; let users;

async function connectMongo() {
  if (users) return users;
  if (!uri) throw new Error('MONGO_URI not set in environment');
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000, tlsAllowInvalidCertificates: true });
  await client.connect();
  db = client.db(dbName);
  users = db.collection('users');
  await users.createIndex({ username: 1 }, { unique: true });
  return users;
}

function getUsersCollection() { if (!users) throw new Error('Mongo not connected yet'); return users; }
function getClient() { return client; }
module.exports = { connectMongo, getUsersCollection, getClient };
