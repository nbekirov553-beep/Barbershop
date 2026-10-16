import { describe, expect, it } from "vitest";
import { computeDaySlots, subtractIntervals, type DaySlotsInput } from "./slots.js";

const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const fmt = (slots: number[]) =>
  slots.map((m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);

const base: DaySlotsInput = {
  workingHours: { start: h(10), end: h(21) },
  breaks: [],
  busy: [],
  durationMin: 60,
  stepMin: 15,
  earliestStart: 0,
};

describe("subtractIntervals", () => {
  it("вырезает интервал из середины", () => {
    expect(subtractIntervals({ start: 0, end: 100 }, [{ start: 40, end: 60 }])).toEqual([
      { start: 0, end: 40 },
      { start: 60, end: 100 },
    ]);
  });

  it("обрезает края и игнорирует непересекающиеся и пустые интервалы", () => {
    expect(
      subtractIntervals({ start: 10, end: 90 }, [
        { start: 0, end: 20 },
        { start: 80, end: 120 },
        { start: 200, end: 300 },
        { start: 50, end: 50 },
      ]),
    ).toEqual([{ start: 20, end: 80 }]);
  });

  it("полностью перекрытый интервал исчезает", () => {
    expect(subtractIntervals({ start: 10, end: 20 }, [{ start: 0, end: 30 }])).toEqual([]);
  });
});

describe("computeDaySlots", () => {
  it("выходной даёт пустой список", () => {
    expect(computeDaySlots({ ...base, workingHours: null })).toEqual([]);
  });

  it("последний слот заканчивается ровно к закрытию", () => {
    const slots = fmt(computeDaySlots(base));
    expect(slots[0]).toBe("10:00");
    expect(slots.at(-1)).toBe("20:00");
    expect(slots).toHaveLength(41);
  });

  it("услуга не пересекает перерыв", () => {
    const slots = fmt(computeDaySlots({ ...base, breaks: [{ start: h(13), end: h(14) }] }));
    expect(slots).toContain("12:00");
    expect(slots).not.toContain("12:15");
    expect(slots).not.toContain("13:30");
    expect(slots).toContain("14:00");
  });

  it("учитывает длительность нескольких услуг", () => {
    const slots = fmt(
      computeDaySlots({ ...base, durationMin: 90, breaks: [{ start: h(13), end: h(14) }] }),
    );
    expect(slots).toContain("11:30");
    expect(slots).not.toContain("11:45");
    expect(slots.at(-1)).toBe("19:30");
  });

  it("существующая запись и time_off блокируют пересекающиеся старты", () => {
    const slots = fmt(
      computeDaySlots({
        ...base,
        busy: [
          { start: h(11), end: h(12) },
          { start: h(18), end: h(21) },
        ],
      }),
    );
    expect(slots).toContain("10:00");
    expect(slots).not.toContain("10:15");
    expect(slots).not.toContain("11:45");
    expect(slots).toContain("12:00");
    expect(slots.at(-1)).toBe("17:00");
  });

  it("не показывает время раньше earliestStart и выравнивает по шагу", () => {
    const slots = fmt(computeDaySlots({ ...base, earliestStart: h(18, 55) }));
    expect(slots).toEqual(["19:00", "19:15", "19:30", "19:45", "20:00"]);
  });

  it("шаг отсчитывается от начала смены, а не от конца занятого интервала", () => {
    const slots = fmt(computeDaySlots({ ...base, busy: [{ start: h(10), end: h(10, 20) }] }));
    expect(slots[0]).toBe("10:30");
  });

  it("время раньше начала смены не даёт слотов до открытия", () => {
    expect(fmt(computeDaySlots({ ...base, earliestStart: h(8) }))[0]).toBe("10:00");
  });

  it("если день уже прошёл, слотов нет", () => {
    expect(computeDaySlots({ ...base, earliestStart: h(24) })).toEqual([]);
  });
});
