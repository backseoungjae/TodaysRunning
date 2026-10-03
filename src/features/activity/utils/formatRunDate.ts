export function formatRunDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  if (!Number.isFinite(date.getTime())) return '날짜 없음';
  return date.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatWeekRange(startSeconds: number, endSeconds: number): string {
  const start = new Date(startSeconds * 1000);
  const last = new Date(endSeconds * 1000);
  last.setDate(last.getDate() - 1);
  const options = { month: 'numeric', day: 'numeric' } as const;
  return `${start.getFullYear()}년 ${start.toLocaleDateString('ko-KR', options)} ~ ${last.toLocaleDateString('ko-KR', options)}`;
}
