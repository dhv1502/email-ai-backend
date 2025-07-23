import fs from 'fs';
import path from 'path';

const FILE = path.join('data', 'summaries.json');

function loadDB() {
  if (!fs.existsSync(FILE)) return {};
  return JSON.parse(fs.readFileSync(FILE, 'utf8'));
}
function saveDB(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

let db = loadDB();

export function getSummary(threadId) {
  return db[threadId] || null;
}
export function setSummary(threadId, payload) {
  db[threadId] = { ...payload, ts: Date.now() };
  saveDB(db);
}

const keyFor = (threadId, anchorId) => `draft:${threadId}:${anchorId}`;

export function getDraft(threadId, anchorId) {
  return db[keyFor(threadId, anchorId)] || null;
}
export function setDraft(threadId, anchorId, payload) {
  db[keyFor(threadId, anchorId)] = { ...payload, ts: Date.now() };
  saveDB(db);
}
