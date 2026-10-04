const levelOrder = {
  beginner: 0,
  elementary: 1,
  intermediate: 2,
  upperIntermediate: 3,
  advanced: 4,
};

const practiceGoalWeight = {
  dailyConversation: 25,
  interviewPractice: 18,
  workplaceEnglish: 16,
  travelEnglish: 12,
  generalSpeaking: 14,
  confidenceBuilding: 20,
};

export function buildAiCoachProfile(user = {}) {
  const normalized = normalizeUserProfile(user);

  return {
    ...normalized,
    id: 'ai-coach',
    displayName: 'Agora AI Coach',
    avatarEmoji: '🤖',
    isAiCoach: true,
    nativeLanguage: normalized.nativeLanguage,
    practiceGoal: normalized.practiceGoal,
    interests: normalized.interests.length > 0 ? normalized.interests : ['general'],
    waitingMinutes: 0,
  };
}

export function normalizeUserProfile(user) {
  return {
    id: user.id ?? user.socketId ?? 'anonymous-user',
    socketId: user.socketId ?? user.id ?? 'anonymous-user',
    nativeLanguage: user.nativeLanguage ?? 'other',
    englishLevel: user.englishLevel ?? 'intermediate',
    practiceGoal: user.practiceGoal ?? 'dailyConversation',
    interests: Array.isArray(user.interests) ? user.interests : [],
    waitingMinutes: Number(user.waitingMinutes ?? 0),
  };
}

export function compatibilityScore(a, b) {
  const normalizedA = normalizeUserProfile(a);
  const normalizedB = normalizeUserProfile(b);

  let score = 0;

  if (normalizedA.practiceGoal === normalizedB.practiceGoal) {
    score += 30;
  } else {
    score += Math.max(0, 12 - Math.abs((practiceGoalWeight[normalizedA.practiceGoal] ?? 10) - (practiceGoalWeight[normalizedB.practiceGoal] ?? 10)) / 3);
  }

  const levelGap = Math.abs((levelOrder[normalizedA.englishLevel] ?? 2) - (levelOrder[normalizedB.englishLevel] ?? 2));
  if (levelGap <= 1) {
    score += 28;
  } else if (levelGap <= 2) {
    score += 14;
  }

  const sharedInterests = normalizedA.interests.filter((interest) => normalizedB.interests.includes(interest)).length;
  score += sharedInterests * 12;

  if (normalizedA.nativeLanguage === normalizedB.nativeLanguage) {
    score += 10;
  }

  score += Math.min(Math.max(normalizedA.waitingMinutes, normalizedB.waitingMinutes), 10);

  return score;
}

export function findBestPair(queue) {
  if (!Array.isArray(queue) || queue.length < 2) {
    return null;
  }

  const candidates = queue.map(normalizeUserProfile);
  let bestPair = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const pairScore = compatibilityScore(candidates[i], candidates[j]);
      if (pairScore > bestScore) {
        bestScore = pairScore;
        bestPair = {
          a: candidates[i],
          b: candidates[j],
          score: pairScore,
        };
      }
    }
  }

  return bestPair;
}
