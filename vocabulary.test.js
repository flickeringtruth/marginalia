import test from "node:test";
import assert from "node:assert/strict";
import { nextSchedule } from "./build/vocabulary.js";

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

test("a new word marked correct is due in one day", () => {
  const now = 1_000_000;
  assert.deepEqual(nextSchedule({ intervalDays: 0, repetitions: 0 }, "good", now), {
    dueAt: now + DAY,
    intervalDays: 1,
    repetitions: 1
  });
});

test("correct reviews grow intervals from one to three days and then double", () => {
  const now = 1_000_000;
  assert.deepEqual(nextSchedule({ intervalDays: 1, repetitions: 1 }, "good", now), {
    dueAt: now + 3 * DAY,
    intervalDays: 3,
    repetitions: 2
  });
  assert.deepEqual(nextSchedule({ intervalDays: 3, repetitions: 2 }, "good", now), {
    dueAt: now + 6 * DAY,
    intervalDays: 6,
    repetitions: 3
  });
});

test("marking a word for another try resets it and schedules a short retry", () => {
  const now = 1_000_000;
  assert.deepEqual(nextSchedule({ intervalDays: 12, repetitions: 4 }, "again", now), {
    dueAt: now + 10 * MINUTE,
    intervalDays: 0,
    repetitions: 0
  });
});
