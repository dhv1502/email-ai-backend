import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import OpenAI from 'openai';

import {
  fetchUnread,
  getThread,
  getLastMessageInThread,
  parseMessage,
  parseMessages,
  getOrCreateLabel,
  addLabelToMessage
} from './src/gmail.js';

import { classifyWithKNN } from './src/embeddingStore.js';
import { classifyEmail } from './src/classifier.js';
import { summarizeEmail } from './src/summarizer.js';

import {
  getSummary,
  setSummary,
  getDraft,
  setDraft
} from './src/store.js';

const app = express();
app.use(cors());
app.use(express.json());
app.set('json spaces', 2);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MY_EMAIL = (process.env.MY_EMAIL || '').toLowerCase();
const DEBUG = process.env.DEBUG === '1';
const TTL = 1000 * 60 * 60 * 6;

const dlog = (...a) => DEBUG && console.log('[API]', ...a);

async function buildSummary(email) {
  const knn = await classifyWithKNN(email);
  const label = (knn?.confidence >= 0.6) ? knn.label : await classifyEmail(email);
  const summary = await summarizeEmail(email);
  return { subject: email.subject, label, summary };
}

app.get('/summary/thread/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    if (!threadId) return res.status(400).json({ error: 'Missing threadId' });

    const cached = getSummary(threadId);
    if (cached) {
      dlog('summary cache hit', threadId);
      return res.json(cached);
    }

    const raw = await getLastMessageInThread(threadId);
    if (!raw) return res.status(404).json({ error: 'Not found' });

    const email = parseMessage(raw);
    dlog('summary build', threadId, email.subject);
    const result = await buildSummary(email);
    setSummary(threadId, result);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/reply', async (req, res) => {
  try {
    const { threadId, replyToId, force } = req.query;
    if (!threadId) return res.status(400).json({ error: 'Missing threadId' });

    const rawThread = await getThread(threadId);
    const msgs = parseMessages(rawThread.messages || []);
    if (!msgs.length) return res.status(404).json({ error: 'Thread empty' });

    let idx = msgs.length - 1;
    if (replyToId) {
      const i = msgs.findIndex(m => m.id === replyToId);
      if (i !== -1) idx = i;
    }
    const anchor = msgs[idx];
    const anchorId = anchor.id;
    const lastFromMe = MY_EMAIL && anchor.from.toLowerCase().includes(MY_EMAIL);

    dlog('reply req', { threadId, replyToId, anchorId, subj: anchor.subject, lastFromMe });

    const cached = getDraft(threadId, anchorId);
    const fresh = cached && Date.now() - cached.ts < TTL;
    if (!force && cached && fresh) {
      dlog('reply cache hit', threadId, anchorId);
      return res.json({ ...cached, anchorId });
    }

    const history = msgs
      .slice(0, idx + 1)
      .map(m => `${m.from.toLowerCase().includes(MY_EMAIL) ? 'Me' : 'Them'}:\n${m.body}`)
      .join('\n\n---\n\n');

    const prompt = lastFromMe
      ? `I wrote the last message. Draft a concise, polite follow-up.\n\nConversation:\n${history}\n\nReturn ONLY the email body.`
      : `Draft a professional, polite reply to the last message.\n\nConversation:\n${history}\n\nReturn ONLY the email body.`;

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3
    });

    const draft = resp.choices[0].message.content.trim();
    const payload = { draft, lastFromMe, replyToId: anchorId };
    setDraft(threadId, anchorId, payload);
    dlog('reply built', { threadId, anchorId });

    res.json({ ...payload, anchorId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/emails', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const emails = await fetchUnread(limit);
    const out = [];
    for (const e of emails) {
      const { subject, from } = e;
      const knn = await classifyWithKNN(e);
      const label = (knn?.confidence >= 0.6) ? knn.label : await classifyEmail(e);
      const summary = await summarizeEmail(e);
      out.push({ id: e.id, subject, from, label, summary });
    }
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/label', async (req, res) => {
  try {
    const { messageId, label } = req.body;
    if (!messageId || !label) {
      return res.status(400).json({ error: 'Provide messageId and label' });
    }
    const labelId = await getOrCreateLabel(label);
    await addLabelToMessage(messageId, labelId, true);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 API running http://localhost:${PORT}`));
