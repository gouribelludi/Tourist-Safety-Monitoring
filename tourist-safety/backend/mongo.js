// Copied from email alert tourist-safety backend for parity.
const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/?directConnection=true';
const DB_NAME = process.env.MONGO_DB || 'tourist_safety';

let client; let db; let contactsCol; let usersCol;

async function connect() {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(DB_NAME);
  contactsCol = db.collection('emergency_contacts');
  usersCol = db.collection('users');
  await contactsCol.createIndex({ userId: 1 });
  await usersCol.createIndex({ id: 1 }, { unique: true });
  return db;
}
function getContactsCollection(){ if(!contactsCol) throw new Error('Mongo not connected yet'); return contactsCol; }
function getUsersCollection(){ if(!usersCol) throw new Error('Mongo not connected yet'); return usersCol; }
async function saveContacts(userId, emails=[], phones=[]) {
  const col = getContactsCollection();
  await col.deleteMany({ userId });
  const docs=[];
  emails.filter(Boolean).forEach(email=>docs.push({ userId, email }));
  phones.filter(Boolean).forEach(phone=>docs.push({ userId, phone }));
  if(docs.length) await col.insertMany(docs);
  return { inserted: docs.length };
}
async function getContacts(userId){ return getContactsCollection().find({ userId }).toArray(); }
async function saveUser(id, name, email){ const col = getUsersCollection(); await col.updateOne({ id }, { $set:{ name, email } }, { upsert:true }); return { id, name, email }; }
async function getUser(id){ return getUsersCollection().findOne({ id }); }
module.exports = { connect, saveContacts, getContacts, saveUser, getUser };
