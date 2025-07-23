import { ruleBasedCategory } from './categories.js';
import { classifyWithKNN } from './embeddingStore.js';
import { classifyEmailLLM } from './classifier.js';

export async function determineLabel(email) {

  const rule = ruleBasedCategory(email);
  if (rule) return rule;


  const knn = await classifyWithKNN(email);
  if (knn && knn.confidence >= 0.6) return knn.label;


  return await classifyEmailLLM(email);
}
