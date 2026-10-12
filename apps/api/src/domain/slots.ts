/** Интервал в минутах от начала локального дня салона, конец не включается: [start, end). */
export type Interval = { start: number; end: number };

export type DaySlotsInput = {
  /** null = мастер в этот день не работает. */
  workingHours: Interval | null;
  breaks: Interval[];
  /** time_off и существующие confirmed-записи, уже переведённые в минуты дня. */
  busy: Interval[];
  durationMin: number;
  stepMin: number;
  /** Раньше этой минуты начинать нельзя: прошедшее время + min_notice_min. */
  earliestStart: number;
};

export function subtractIntervals(base: Interval, cuts: Interval[]): Interval[] {
  let free: Interval[] = [base];

  for (const cut of cuts) {
    if (cut.end <= cut.start) continue;
    free = free.flatMap((interval) => {
      if (cut.end <= interval.start || cut.start >= interval.end) return [interval];
      const parts: Interval[] = [];
      if (cut.start > interval.start) parts.push({ start: interval.start, end: cut.start });
      if (cut.end < interval.end) parts.push({ start: cut.end, end: interval.end });
      return parts;
    });
  }

  return free;
}

/** Старты с шагом stepMin, отсчитанным от начала смены, при которых вся услуга помещается в свободное окно. */
export function computeDaySlots(input: DaySlotsInput): number[] {
  const { workingHours, breaks, busy, durationMin, stepMin, earliestStart } = input;
  if (!workingHours || durationMin <= 0 || stepMin <= 0) return [];

  const free = subtractIntervals(workingHours, [...breaks, ...busy]);
  const slots: number[] = [];

  for (const interval of free) {
    const from = Math.max(interval.start, earliestStart);
    const stepsFromShiftStart = Math.ceil((from - workingHours.start) / stepMin);
    for (
      let start = workingHours.start + Math.max(0, stepsFromShiftStart) * stepMin;
      start + durationMin <= interval.end;
      start += stepMin
    ) {
      if (start >= interval.start) slots.push(start);
    }
  }

  return slots;
}
