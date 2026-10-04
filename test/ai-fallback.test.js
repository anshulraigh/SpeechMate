import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAiCoachProfile } from '../src/matchmaker.js';

test('buildAiCoachProfile creates a valid AI practice partner profile', () => {
  const profile = buildAiCoachProfile({ practiceGoal: 'dailyConversation', nativeLanguage: 'english' });

  assert.equal(profile.id, 'ai-coach');
  assert.equal(profile.displayName, 'Agora AI Coach');
  assert.equal(profile.isAiCoach, true);
  assert.equal(profile.practiceGoal, 'dailyConversation');
  assert.equal(profile.nativeLanguage, 'english');
});
