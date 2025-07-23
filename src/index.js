import { fetchUnread } from './gmail.js';
import { determineLabel } from './determineLabel.js';
import { summarizeEmail } from './summarizer.js';
// (optional) import { appendLabeled } from './embeddingStore.js';

(async () => {
  const limit = parseInt(process.argv[2] || '10', 10);
  const emails = await fetchUnread(limit);

  for (const e of emails) {
    const label = await determineLabel(e);
    const summary = await summarizeEmail(e);

    console.log('---');
    console.log('Subject:', e.subject);
    console.log('From   :', e.from);
    console.log('Label  :', label);
    console.log('Summary:', summary);

    // If you want to grow your training set manually:
    // appendLabeled({ id: e.id, subject: e.subject, body: e.body, label });
  }
})();
