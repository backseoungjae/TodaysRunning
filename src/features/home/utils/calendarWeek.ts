// Calendar weeks start on Monday in the device's local timezone.
export function getCalendarWeek(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const dateKey = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return { dateKey, startSeconds: Math.floor(start.getTime() / 1000), endSeconds: Math.floor(end.getTime() / 1000) };
}
