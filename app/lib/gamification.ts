import { db } from './firebase';
import { doc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';

// 뱃지 정의
export const BADGES = [
  { id:'badge_first_word',   icon:'🌱', name:'첫 단어',       desc:'첫 번째 단어 학습 완료' },
  { id:'badge_words_10',     icon:'📖', name:'단어 10개',      desc:'누적 10개 단어 학습' },
  { id:'badge_words_50',     icon:'📚', name:'단어 50개',      desc:'누적 50개 단어 학습' },
  { id:'badge_words_100',    icon:'🎓', name:'단어 100개',     desc:'누적 100개 단어 학습' },
  { id:'badge_streak_3',     icon:'🔥', name:'3일 연속',       desc:'3일 연속 학습' },
  { id:'badge_streak_7',     icon:'🔥🔥', name:'일주일 연속', desc:'7일 연속 학습' },
  { id:'badge_streak_30',    icon:'👑', name:'한달 연속',      desc:'30일 연속 학습' },
  { id:'badge_quiz_perfect', icon:'⭐', name:'퀴즈 만점',      desc:'퀴즈 10문제 전부 정답' },
  { id:'badge_quiz_10',      icon:'🎮', name:'퀴즈 10회',      desc:'퀴즈 10회 완료' },
  { id:'badge_grammar_1',    icon:'✏️', name:'첫 문법',        desc:'문법 1개 완료' },
  { id:'badge_conversation', icon:'💬', name:'첫 회화',        desc:'회화 시나리오 1개 완료' },
  { id:'badge_level_5',      icon:'🚀', name:'레벨 5',         desc:'레벨 5 달성' },
  { id:'badge_level_10',     icon:'💎', name:'레벨 10',        desc:'레벨 10 달성' },
];

// 스트릭 업데이트
export async function updateStreak(userId: string) {
  const userRef = doc(db, 'users', userId);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const data = snap.data();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const lastStudy = data.lastStudyDate?.toDate?.();

  let newStreak = data.streak || 0;
  let bonusXP = 0;

  if (!lastStudy) {
    // 첫 학습
    newStreak = 1;
  } else {
    const lastDay = new Date(lastStudy.getFullYear(), lastStudy.getMonth(), lastStudy.getDate());
    const diffDays = Math.round((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // 오늘 이미 학습함 → 스트릭 변화 없음
      return { streak: newStreak, newBadges: [] };
    } else if (diffDays === 1) {
      // 연속 학습!
      newStreak = newStreak + 1;
    } else {
      // 스트릭 끊김
      newStreak = 1;
    }
  }

  // 스트릭 보너스 XP
  if (newStreak === 7)  bonusXP = 100;
  if (newStreak === 30) bonusXP = 500;

  await updateDoc(userRef, {
    streak: newStreak,
    lastStudyDate: now,
    ...(bonusXP > 0 && { totalXP: (data.totalXP || 0) + bonusXP }),
  });

  // 뱃지 체크
  const newBadges = await checkAndAwardBadges(userId, {
    ...data,
    streak: newStreak,
  });

  return { streak: newStreak, bonusXP, newBadges };
}

// 뱃지 체크 & 지급
export async function checkAndAwardBadges(userId: string, userData: any) {
  const userRef = doc(db, 'users', userId);
  const currentBadges: string[] = userData.badges || [];
  const newBadges: typeof BADGES = [];

  const wordsStudied = userData.wordsStudied || 0;
  const streak = userData.streak || 0;
  const quizCount = userData.quizCount || 0;
  const learnedGrammar = userData.learnedGrammar || [];
  const conversationCount = userData.conversationCount || 0;
  const level = Math.floor((userData.totalXP || 0) / 100) + 1;

  const checks = [
    { id:'badge_first_word',   condition: wordsStudied >= 1 },
    { id:'badge_words_10',     condition: wordsStudied >= 10 },
    { id:'badge_words_50',     condition: wordsStudied >= 50 },
    { id:'badge_words_100',    condition: wordsStudied >= 100 },
    { id:'badge_streak_3',     condition: streak >= 3 },
    { id:'badge_streak_7',     condition: streak >= 7 },
    { id:'badge_streak_30',    condition: streak >= 30 },
    { id:'badge_quiz_10',      condition: quizCount >= 10 },
    { id:'badge_grammar_1',    condition: learnedGrammar.length >= 1 },
    { id:'badge_conversation', condition: conversationCount >= 1 },
    { id:'badge_level_5',      condition: level >= 5 },
    { id:'badge_level_10',     condition: level >= 10 },
  ];

  for (const check of checks) {
    if (check.condition && !currentBadges.includes(check.id)) {
      const badge = BADGES.find(b => b.id === check.id);
      if (badge) newBadges.push(badge);
    }
  }

  if (newBadges.length > 0) {
    await updateDoc(userRef, {
      badges: arrayUnion(...newBadges.map(b => b.id)),
    });
  }

  return newBadges;
}