import { describe, it, expect } from "vitest";
import {
  resolveFloating,
  dateInYear,
  nextOccurrence,
  daysBetween,
  ageOnNext,
  whenLabel,
  LEAD_TIMES_DAYS,
} from "../calendarEvents";

/** Dates are compared as local Y-M-D; the module works in local time throughout. */
const ymd = (d: Date | null) =>
  d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : null;

describe("resolveFloating", () => {
  // Checked against the actual calendar, not against the implementation.
  it("finds Mother's Day — the 2nd Sunday in May", () => {
    expect(ymd(resolveFloating("mothers_day", 2026))).toBe("2026-5-10");
    expect(ymd(resolveFloating("mothers_day", 2027))).toBe("2027-5-9");
  });

  it("finds Father's Day — the 3rd Sunday in June", () => {
    expect(ymd(resolveFloating("fathers_day", 2026))).toBe("2026-6-21");
    expect(ymd(resolveFloating("fathers_day", 2027))).toBe("2027-6-20");
  });

  it("finds Thanksgiving — the 4th Thursday in November", () => {
    expect(ymd(resolveFloating("thanksgiving", 2026))).toBe("2026-11-26");
    expect(ymd(resolveFloating("thanksgiving", 2027))).toBe("2027-11-25");
  });

  it("handles a month starting on the weekday it is counting", () => {
    // Nov 2029 starts on a Thursday, so the 4th Thursday is the 22nd — the
    // case an off-by-one in the offset calculation gets wrong.
    expect(ymd(resolveFloating("thanksgiving", 2029))).toBe("2029-11-22");
  });
});

describe("dateInYear", () => {
  it("returns null for an event with no date at all", () => {
    expect(dateInYear({ month: null, day: null, floating_key: null }, 2026)).toBeNull();
  });

  it("returns null when only half a date is set", () => {
    expect(dateInYear({ month: 5, day: null, floating_key: null }, 2026)).toBeNull();
    expect(dateInYear({ month: null, day: 5, floating_key: null }, 2026)).toBeNull();
  });

  it("prefers the floating key over a stored month/day", () => {
    expect(ymd(dateInYear({ month: 1, day: 1, floating_key: "thanksgiving" }, 2026))).toBe(
      "2026-11-26",
    );
  });

  /**
   * A Feb 29 birthday in a common year has no exact date. JavaScript rolls it
   * forward to Mar 1 rather than erroring, and the app shows and reminds on
   * that day. Pinned rather than changed: both conventions are defensible and
   * this one is at least consistent between the list and the reminder.
   */
  it("rolls a Feb 29 birthday to Mar 1 in a common year", () => {
    expect(ymd(dateInYear({ month: 2, day: 29, floating_key: null }, 2027))).toBe("2027-3-1");
    expect(ymd(dateInYear({ month: 2, day: 29, floating_key: null }, 2028))).toBe("2028-2-29");
  });
});

describe("nextOccurrence", () => {
  const bday = { month: 6, day: 21, floating_key: null };

  it("counts today as the next occurrence, not one already missed", () => {
    expect(ymd(nextOccurrence(bday, new Date(2026, 5, 21, 23, 30)))).toBe("2026-6-21");
  });

  it("rolls into next year once the date has passed", () => {
    expect(ymd(nextOccurrence(bday, new Date(2026, 5, 22)))).toBe("2027-6-21");
  });

  it("rolls a floating holiday into next year too", () => {
    expect(ymd(nextOccurrence({ month: null, day: null, floating_key: "thanksgiving" }, new Date(2026, 11, 1)))).toBe(
      "2027-11-25",
    );
  });

  it("is null for an event with no date", () => {
    expect(nextOccurrence({ month: null, day: null, floating_key: null })).toBeNull();
  });
});

describe("daysBetween", () => {
  it("ignores time of day, so late evening is not a day early", () => {
    expect(daysBetween(new Date(2026, 0, 1, 23, 59), new Date(2026, 0, 2, 0, 1))).toBe(1);
  });

  it("is zero for the same day", () => {
    expect(daysBetween(new Date(2026, 0, 1, 1), new Date(2026, 0, 1, 22))).toBe(0);
  });

  it("is negative looking backwards", () => {
    expect(daysBetween(new Date(2026, 0, 5), new Date(2026, 0, 1))).toBe(-4);
  });

  it("counts whole days across a spring-forward boundary", () => {
    // US DST 2026 starts Mar 8; that day is 23 hours long, and a plain
    // division would round it to zero.
    expect(daysBetween(new Date(2026, 2, 7), new Date(2026, 2, 9))).toBe(2);
  });
});

describe("ageOnNext", () => {
  it("gives the age they are turning, not the age they are", () => {
    expect(ageOnNext({ birth_year: 1990, month: 6, day: 21, floating_key: null }, new Date(2026, 0, 1))).toBe(36);
  });

  it("counts the coming birthday once this year's has passed", () => {
    expect(ageOnNext({ birth_year: 1990, month: 6, day: 21, floating_key: null }, new Date(2026, 11, 1))).toBe(37);
  });

  it("is null without a birth year rather than guessing one", () => {
    expect(ageOnNext({ birth_year: null, month: 6, day: 21, floating_key: null })).toBeNull();
  });
});

describe("whenLabel", () => {
  const from = new Date(2026, 5, 1);
  const plus = (n: number) => new Date(2026, 5, 1 + n);

  it("names the near days", () => {
    expect(whenLabel(plus(0), from)).toBe("Today");
    expect(whenLabel(plus(1), from)).toBe("Tomorrow");
    expect(whenLabel(plus(3), from)).toBe("In 3 days");
  });

  it("switches to weeks at a week out", () => {
    expect(whenLabel(plus(6), from)).toBe("In 6 days");
    expect(whenLabel(plus(7), from)).toBe("In 1w");
    expect(whenLabel(plus(29), from)).toBe("In 4w");
  });

  it("falls back to a date beyond a month", () => {
    expect(whenLabel(plus(45), from)).toMatch(/Jul/);
  });
});

describe("lead times", () => {
  it("includes the day itself, so an event is never announced only in advance", () => {
    expect(LEAD_TIMES_DAYS).toContain(0);
  });

  it("is ordered furthest-out first and has no duplicates", () => {
    const arr = [...LEAD_TIMES_DAYS];
    expect(arr).toEqual([...arr].sort((a, b) => b - a));
    expect(new Set(arr).size).toBe(arr.length);
  });
});
