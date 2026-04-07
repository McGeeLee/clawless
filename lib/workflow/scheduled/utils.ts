const MAX_DELAY_MS = 3 * 24 * 60 * 60 * 1000;
const DEFAULT_SCHEDULE_TIMEZONE = 'Asia/Shanghai';

type TimeZoneParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

function getTimeZoneParts(date: Date, timeZone: string): TimeZoneParts {
  const values = getFormatter(timeZone).formatToParts(date);
  const lookup = new Map(values.map((part) => [part.type, part.value]));

  return {
    year: Number(lookup.get('year')),
    month: Number(lookup.get('month')),
    day: Number(lookup.get('day')),
    hour: Number(lookup.get('hour')),
    minute: Number(lookup.get('minute')),
    second: Number(lookup.get('second')),
  };
}

function getOffsetMs(date: Date, timeZone: string): number {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(input: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second?: number;
  timeZone: string;
}): Date {
  const targetUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second ?? 0,
    0,
  );

  let guess = targetUtc;
  for (let index = 0; index < 4; index += 1) {
    const offset = getOffsetMs(new Date(guess), input.timeZone);
    const nextGuess = targetUtc - offset;
    if (Math.abs(nextGuess - guess) < 1000) {
      guess = nextGuess;
      break;
    }
    guess = nextGuess;
  }

  return new Date(guess);
}

function addLocalDays(
  parts: Pick<TimeZoneParts, 'year' | 'month' | 'day'>,
  days: number,
) {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

export function getDefaultScheduleTimezone(): string {
  return DEFAULT_SCHEDULE_TIMEZONE;
}

export function validateTimezone(timeZone: string): string {
  try {
    Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    throw new Error(`Invalid timezone "${timeZone}".`);
  }
}

export function parseDelayTarget(input: {
  runAt?: string | null;
  delaySeconds?: number | null;
  now?: Date;
}): Date {
  const now = input.now ?? new Date();

  if (typeof input.delaySeconds === 'number') {
    const milliseconds = input.delaySeconds * 1000;
    if (!Number.isFinite(milliseconds) || milliseconds <= 0) {
      throw new Error('delaySeconds must be a positive number.');
    }
    if (milliseconds > MAX_DELAY_MS) {
      throw new Error('Delay tasks cannot exceed 3 days.');
    }
    return new Date(now.getTime() + milliseconds);
  }

  if (!input.runAt) {
    throw new Error('Delay task requires runAt or delaySeconds.');
  }

  const target = new Date(input.runAt);
  if (Number.isNaN(target.getTime())) {
    throw new Error('runAt must be a valid ISO datetime.');
  }

  const delta = target.getTime() - now.getTime();
  if (delta <= 0) {
    throw new Error('Delay task must be scheduled in the future.');
  }
  if (delta > MAX_DELAY_MS) {
    throw new Error('Delay tasks cannot exceed 3 days.');
  }

  return target;
}

export function parseDailyTime(value: string): {
  hour: number;
  minute: number;
} {
  const trimmed = value.trim();
  const matched = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(trimmed);
  if (!matched) {
    throw new Error('dailyTime must use HH:mm format.');
  }

  return {
    hour: Number(matched[1]),
    minute: Number(matched[2]),
  };
}

export function computeNextDailyRunAt(input: {
  dailyTime: string;
  timeZone?: string | null;
  now?: Date;
}): Date {
  const now = input.now ?? new Date();
  const timeZone = validateTimezone(
    input.timeZone?.trim() || DEFAULT_SCHEDULE_TIMEZONE,
  );
  const targetTime = parseDailyTime(input.dailyTime);
  const localNow = getTimeZoneParts(now, timeZone);

  let candidate = zonedDateTimeToUtc({
    year: localNow.year,
    month: localNow.month,
    day: localNow.day,
    hour: targetTime.hour,
    minute: targetTime.minute,
    timeZone,
  });

  if (candidate.getTime() <= now.getTime()) {
    const nextDay = addLocalDays(localNow, 1);
    candidate = zonedDateTimeToUtc({
      year: nextDay.year,
      month: nextDay.month,
      day: nextDay.day,
      hour: targetTime.hour,
      minute: targetTime.minute,
      timeZone,
    });
  }

  return candidate;
}

export function sameInstant(left: Date | null, right: Date | null): boolean {
  if (!left || !right) {
    return false;
  }
  return left.getTime() === right.getTime();
}
