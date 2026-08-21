export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly';

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function nextOccurrence(current: Date, freq: RecurrenceFreq, weekday: number | null): Date {
  if (freq === 'daily') {
    return addDays(current, 1);
  }
  if (freq === 'weekly') {
    if (weekday === null) {
      return addDays(current, 7);
    }
    let next = addDays(current, 1);
    while (next.getDay() !== weekday) {
      next = addDays(next, 1);
    }
    next.setHours(current.getHours(), current.getMinutes(), current.getSeconds(), current.getMilliseconds());
    return next;
  }
  return addMonths(current, 1);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const daysInTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(day, daysInTargetMonth));
  return result;
}

export function formatRecurrence(freq: RecurrenceFreq | null, weekday: number | null): string | null {
  if (freq === 'daily') {
    return 'Daily';
  }
  if (freq === 'weekly') {
    return weekday === null ? 'Weekly' : `Weekly on ${WEEKDAY_NAMES[weekday]}`;
  }
  if (freq === 'monthly') {
    return 'Monthly';
  }
  return null;
}

export function formatDueAt(dueAt: string | null): string | null {
  if (!dueAt) {
    return null;
  }
  const date = new Date(dueAt);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
