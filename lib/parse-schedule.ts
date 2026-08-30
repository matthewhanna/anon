import * as chrono from 'chrono-node';

import { WEEKDAY_NAMES, type RecurrenceFreq } from '@/lib/recurrence';

export type ParsedSchedule = {
  dueAt: Date;
  recurrenceFreq: RecurrenceFreq | null;
  recurrenceWeekday: number | null;
};

export const SCHEDULE_HELP =
  'Couldn\'t understand that — try "8/25/26", "next Tue", or "every Tue at 11a".';

const RECURRING_PREFIX = /^\s*(every|each)\b/i;
const FREQ_KEYWORDS: { regex: RegExp; freq: RecurrenceFreq }[] = [
  { regex: /\bdaily\b|\bday\b/i, freq: 'daily' },
  { regex: /\bweekly\b/i, freq: 'weekly' },
  { regex: /\bmonthly\b|\bmonth\b/i, freq: 'monthly' },
];
const WEEKDAY_PATTERN = /\b(sun|mon|tue|wed|thu|fri|sat)\w*\b/i;

// Chrono doesn't understand "11a"/"3p" shorthand on their own; normalize to
// "11am"/"3pm" before handing off to it.
function normalizeShorthandTime(text: string): string {
  return text.replace(/\b(\d{1,2})a\b/gi, '$1am').replace(/\b(\d{1,2})p\b/gi, '$1pm');
}

// "next Tue", "8/25/26", "tomorrow at 3pm" — one-off dates.
// "every Tue at 11a", "daily at 8am", "weekly" — recurring; the anchor date/time
// is parsed the same way, then interpreted as the first occurrence.
export function parseScheduleInput(text: string, referenceDate: Date = new Date()): ParsedSchedule | null {
  const trimmed = normalizeShorthandTime(text.trim());
  if (!trimmed) {
    return null;
  }

  const isRecurring = RECURRING_PREFIX.test(trimmed) || /\b(daily|weekly|monthly)\b/i.test(trimmed);
  if (!isRecurring) {
    const parsed = chrono.parseDate(trimmed, referenceDate, { forwardDate: true });
    return parsed ? { dueAt: parsed, recurrenceFreq: null, recurrenceWeekday: null } : null;
  }

  let freq: RecurrenceFreq = 'weekly';
  for (const { regex, freq: candidate } of FREQ_KEYWORDS) {
    if (regex.test(trimmed)) {
      freq = candidate;
      break;
    }
  }

  // "\bmon\w*\b" also matches inside "month"/"monthly" — don't let that look like Monday.
  const weekdayMatch = trimmed.match(WEEKDAY_PATTERN);
  let weekday: number | null = null;
  if (weekdayMatch && !/^month/i.test(weekdayMatch[0])) {
    const index = WEEKDAY_NAMES.findIndex((name) => name.toLowerCase().startsWith(weekdayMatch[1].toLowerCase()));
    if (index !== -1) {
      weekday = index;
      freq = 'weekly';
    }
  }

  const remainder = trimmed
    .replace(RECURRING_PREFIX, '')
    .replace(/\b(daily|weekly|monthly)\b/i, '')
    .trim();

  const anchor = chrono.parseDate(remainder || 'today', referenceDate, { forwardDate: true }) ?? referenceDate;

  return { dueAt: anchor, recurrenceFreq: freq, recurrenceWeekday: weekday };
}
