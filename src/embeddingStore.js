import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const LABELED_PATH = path.join('data', 'labeled.jsonl');
const EMBEDDINGS_PATH = path.join('data', 'embeddings.json');

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function embedText(text) {
  const resp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return resp.data[0].embedding;
}

function loadLabeled() {
  if (!fs.existsSync(LABELED_PATH)) return [];
  return fs.readFileSync(LABELED_PATH, 'utf8')
    .split('\n').filter(Boolean)
    .map(line => JSON.parse(line));
}

export function appendLabeled(example) {
  fs.appendFileSync(LABELED_PATH, JSON.stringify(example) + '\n');
}

export async function loadEmbeddingIndex() {
  const labeled = loadLabeled();
  let index = [];
  if (fs.existsSync(EMBEDDINGS_PATH)) {
    index = JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, 'utf8'));
  }

  const existing = new Set(index.map(e => e.key));
  let changed = false;
  for (const ex of labeled) {
    const key = ex.subject + '||' + ex.body.slice(0, 200);
    if (!existing.has(key)) {
      const vec = await embedText(ex.subject + '\n' + ex.body);
      index.push({ key, label: ex.label, vec });
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(EMBEDDINGS_PATH, JSON.stringify(index));
  return index;
}

export async function classifyWithKNN(email, k = 5) {
  const index = await loadEmbeddingIndex();
  if (!index.length) return null;

  const vec = await embedText(email.subject + '\n' + email.body);
  const scored = index.map(e => ({ label: e.label, score: cosine(vec, e.vec) }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.min(k, scored.length));

  const counts = {};
  for (const t of top) counts[t.label] = (counts[t.label] || 0) + 1;
  const label = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  const confidence = counts[label] / top.length;

  return { label, confidence };
}
