import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function summarizeEmail(email) {
  const body = email.body.length > 4000 ? email.body.slice(0, 4000) : email.body;

  const prompt = `You are an assistant that writes 1–2 sentence concise summaries of emails.
Include key action items or deadlines if present.

Email:
Subject: ${email.subject}
From: ${email.from}
Body:
"""
${body}
"""

Return a JSON object: {"summary": "..."} with no extra text.`;

  const resp = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0
  });

  const txt = resp.choices[0].message.content.trim();
  try {
    const obj = JSON.parse(txt);
    return obj.summary || txt;
  } catch {
    return txt;
  }
}
