export const LABELS = ['Recruiters', 'Personal', 'Social Media'];

export const DEFINITIONS = {
  Recruiters: 'Emails about jobs, hiring, applications, recruiters, interviews, career platforms.',
  Personal: 'One‑to‑one / small‑group, non‑recruiting conversations (friends, family, classmates, colleagues).',
  'Social Media': 'Notifications/digests from social platforms (LinkedIn, Facebook, Instagram, X/Twitter, Reddit, etc.).'
};

export const CATEGORIES = [
  {
    name: 'Recruiters',
    keywords: [
      'recruiter','hiring','opportunity','opening','position','role',
      'application','applied','interview','career','job','talent'
    ]
  },
  {
    name: 'Social Media',
    keywords: [
      'linkedin','facebook','instagram','twitter','x.com','reddit','tiktok',
      'notification','mention','follower','connection request'
    ]
  },
  {
    name: 'Personal',
    keywords: [
      'hey','hi ','hello','let\'s meet','see you','catch up','how are you',
      'long time','dinner','coffee'
    ]
  }
];

export function ruleBasedCategory(email) {
  const text = (email.subject + ' ' + email.body).toLowerCase();
  let best = null, maxHits = 0;
  for (const cat of CATEGORIES) {
    const hits = cat.keywords.reduce((acc, kw) => acc + (text.includes(kw) ? 1 : 0), 0);
    if (hits > maxHits) { maxHits = hits; best = cat.name; }
  }
  return maxHits > 0 ? best : null;
}
