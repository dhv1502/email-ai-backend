import 'dotenv/config';
import { google } from 'googleapis';
import { Buffer } from 'node:buffer';

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  GOOGLE_REFRESH_TOKEN
} = process.env;

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);
oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

export async function getGmailClient() {
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

export async function getMessage(id) {
  const gmail = await getGmailClient();
  const res = await gmail.users.messages.get({
    userId: 'me',
    id,
    format: 'full'
  });
  return res.data;
}

export async function getThread(threadId) {
  const gmail = await getGmailClient();
  const res = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full'
  });
  return res.data;
}

export async function getLastMessageInThread(threadId) {
  const t = await getThread(threadId);
  const msgs = t.messages || [];
  return msgs.length ? msgs[msgs.length - 1] : null;
}

export function parseMessage(message) {
  const headers = message.payload.headers || [];
  const find = name => headers.find(h => h.name === name)?.value || '';
  const subject = find('Subject');
  const from    = find('From');
  const date    = find('Date');

  function walk(parts) {
    let text = '';
    for (const p of parts) {
      if (p.filename) continue;
      if (p.mimeType === 'text/plain' && p.body?.data) {
        text += Buffer.from(p.body.data, 'base64').toString('utf8') + '\n';
      } else if (p.mimeType === 'text/html' && p.body?.data) {
        const html = Buffer.from(p.body.data, 'base64').toString('utf8');
        text += html.replace(/<[^>]+>/g, ' ') + '\n';
      } else if (p.parts) {
        text += walk(p.parts);
      }
    }
    return text;
  }

  let bodyText = '';
  if (message.payload.parts) bodyText = walk(message.payload.parts);
  else if (message.payload.body?.data) {
    bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf8');
  }

  return {
    id: message.id,
    threadId: message.threadId,
    subject,
    from,
    date,
    body: bodyText.trim()
  };
}

export function parseMessages(messages) {
  return messages.map(parseMessage);
}

export async function listUnreadIds(maxResults = 5) {
  const gmail = await getGmailClient();
  const res = await gmail.users.messages.list({
    userId: 'me',
    //q: 'is:unread',
    maxResults
  });
  return res.data.messages || [];
}

export async function fetchUnread(limit = 5) {
  const ids = await listUnreadIds(limit);
  const out = [];
  for (const { id } of ids) {
    const raw = await getMessage(id);
    out.push(parseMessage(raw));
  }
  return out;
}

export async function getOrCreateLabel(labelName) {
  const gmail = await getGmailClient();
  const res = await gmail.users.labels.list({ userId: 'me' });
  const labels = res.data.labels || [];

  const existing = labels.find(l => l.name.toLowerCase() === labelName.toLowerCase());
  if (existing) return existing.id;

  const SYSTEM_MAP = { Important: 'IMPORTANT' };
  if (SYSTEM_MAP[labelName]) {
    const sys = labels.find(l => l.name === SYSTEM_MAP[labelName]);
    if (sys) return sys.id;
  }

  const createRes = await gmail.users.labels.create({
    userId: 'me',
    requestBody: {
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show'
    }
  });
  return createRes.data.id;
}

export async function addLabelToMessage(messageId, labelId, markRead = true) {
  const gmail = await getGmailClient();
  const removeLabelIds = markRead ? ['UNREAD'] : [];
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
      removeLabelIds
    }
  });
}
