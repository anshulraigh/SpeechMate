import test from 'node:test';
import assert from 'node:assert/strict';

import { findBestPair, normalizeUserProfile } from '../src/matchmaker.js';

test('normalizes a user profile into a comparable match shape', () => {
  const profile = normalizeUserProfile({
    id: 'user-1',
    nativeLanguage: 'hindi',
    englishLevel: 'intermediate',
    practiceGoal: 'dailyConversation',
    interests: ['travel', 'movies'],
  });

  assert.equal(profile.id, 'user-1');
  assert.equal(profile.nativeLanguage, 'hindi');
  assert.deepEqual(profile.interests, ['travel', 'movies']);
});

test('returns null when fewer than two users are available for matching', () => {
  const pair = findBestPair([
    { id: 'u1', nativeLanguage: 'hindi', englishLevel: 'intermediate', practiceGoal: 'dailyConversation', interests: ['travel'] },
  ]);

  assert.equal(pair, null);
});

test('matches users with the highest compatibility score', () => {
  const users = [
    { id: 'u1', nativeLanguage: 'hindi', englishLevel: 'beginner', practiceGoal: 'dailyConversation', interests: ['travel', 'movies'] },
    { id: 'u2', nativeLanguage: 'english', englishLevel: 'upperIntermediate', practiceGoal: 'dailyConversation', interests: ['travel', 'technology'] },
    { id: 'u3', nativeLanguage: 'hindi', englishLevel: 'advanced', practiceGoal: 'interviewPractice', interests: ['sports'] },
  ];

  const pair = findBestPair(users);

  assert.ok(pair);
  assert.equal(pair.a.id, 'u1');
  assert.equal(pair.b.id, 'u2');
});
