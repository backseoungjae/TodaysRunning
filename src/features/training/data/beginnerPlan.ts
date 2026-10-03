import type { TrainingPlan } from '../types/trainingTypes';

export const beginnerPlan: TrainingPlan = {
  id: 'beginner_4week_v1',
  title: '4주 Beginner Plan',
  description: '주 3회, 나에게 편안한 속도로 차근차근 시작해요.',
  sessions: [
    {
      id: 'week1_day1', week: 1, day: 1, title: 'Walk & Run 15분',
      description: '걷기와 가벼운 달리기를 번갈아 하며 시작해요.',
      goalType: 'time', targetDurationSeconds: 15 * 60,
    },
    {
      id: 'week1_day2', week: 1, day: 2, title: 'Easy Run 20분',
      description: '편안한 속도로 달려요. 중간에 걸어도 좋아요.',
      goalType: 'time', targetDurationSeconds: 20 * 60,
    },
    {
      id: 'week1_day3', week: 1, day: 3, title: 'Easy Run 20분',
      description: '속도보다 편안하게 움직이는 데 집중해요.',
      goalType: 'time', targetDurationSeconds: 20 * 60,
    },
    {
      id: 'week2_day1', week: 2, day: 1, title: 'Easy Run 20분',
      description: '가볍게 달리며 이번 주를 시작해요.',
      goalType: 'time', targetDurationSeconds: 20 * 60,
    },
    {
      id: 'week2_day2', week: 2, day: 2, title: 'Distance Run 2km',
      description: '나만의 속도로 2km를 경험해요. 걷는 구간이 있어도 좋아요.',
      goalType: 'distance', targetDistanceMeters: 2000,
    },
    {
      id: 'week2_day3', week: 2, day: 3, title: 'Easy Run 25분',
      description: '조금 더 길게, 부담 없는 속도로 움직여요.',
      goalType: 'time', targetDurationSeconds: 25 * 60,
    },
    {
      id: 'week3_day1', week: 3, day: 1, title: 'Distance Run 3km',
      description: '서두르지 않고 3km를 향해 나아가요.',
      goalType: 'distance', targetDistanceMeters: 3000,
    },
    {
      id: 'week3_day2', week: 3, day: 2, title: 'Easy Run 20분',
      description: '오늘은 가볍게, 익숙한 속도로 달려요.',
      goalType: 'time', targetDurationSeconds: 20 * 60,
    },
    {
      id: 'week3_day3', week: 3, day: 3, title: 'Easy Run 30분',
      description: '편안한 호흡을 유지하며 천천히 이어가요.',
      goalType: 'time', targetDurationSeconds: 30 * 60,
    },
    {
      id: 'week4_day1', week: 4, day: 1, title: 'Distance Run 3km',
      description: '익숙해진 3km를 나에게 맞는 속도로 달려요.',
      goalType: 'distance', targetDistanceMeters: 3000,
    },
    {
      id: 'week4_day2', week: 4, day: 2, title: 'Easy Run 20분',
      description: '가볍게 몸을 움직이며 다음 도전을 준비해요.',
      goalType: 'time', targetDurationSeconds: 20 * 60,
    },
    {
      id: 'week4_day3', week: 4, day: 3, title: '5km Challenge',
      description: '걷기를 섞어도 괜찮아요. 내 속도로 5km에 도전해요.',
      goalType: 'distance', targetDistanceMeters: 5000,
    },
  ],
};
