import OpenAI from 'openai';
import { LABELS, DEFINITIONS } from './categories.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function classifyEmailLLM(email) {
  const prompt = `
You are an email classifier. Pick exactly one label from: ${LABELS.join(', ')}.

Definitions:
${LABELS.map(l => `- ${l}: ${DEFINITIONS[l]}`).join('\n')}

Email:
Subject: ${email.subject}
Body: ${email.body.slice(0, 1500)}

Respond with ONLY the label text.`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0
  });

  const out = resp.choices[0].message.content.trim();
  return LABELS.find(l => out.toLowerCase().includes(l.toLowerCase())) || 'Personal';
}
