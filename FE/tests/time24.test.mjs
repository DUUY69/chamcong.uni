import { formatTimeInput, toTime24, isValidTime24 } from "../src/utils/time24.jsx";

function eq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

eq(formatTimeInput("0600"), "06:00", "format 0600");
eq(formatTimeInput("06"), "06", "format partial");
eq(toTime24("0600"), "06:00", "parse 0600");
eq(toTime24("600"), "06:00", "parse 600");
eq(toTime24("6:0"), "06:00", "parse 6:0");
eq(toTime24("11:00"), "11:00", "parse 11:00");
eq(isValidTime24("0600"), true, "valid 0600");
console.log("OK: time24 tests passed");
