import { resolveConfirmTimes } from "../src/utils/resolveAttendanceTimes.js";

function calcHours(checkIn, checkOut) {
  const [hi, mi] = checkIn.split(":").map(Number);
  const [ho, mo] = checkOut.split(":").map(Number);
  const mins = ho * 60 + mo - (hi * 60 + mi);
  return Math.round((mins / 60) * 100) / 100;
}

function assertEq(actual, expected, label) {
  if (actual !== expected) throw new Error(`${label}: expected ${expected}, got ${actual}`);
}

const cases = [
  {
    name: "1. Vào sớm → giờ ca ĐK",
    sch: ["16:00", "21:00"],
    act: ["15:57", "21:00"],
    want: ["16:00", "21:00"],
  },
  {
    name: "2. Vào trễ → giờ thực",
    sch: ["16:00", "21:00"],
    act: ["16:24", "21:40"],
    want: ["16:24", "21:00"],
  },
  {
    name: "3. Ra sớm → giờ thực",
    sch: ["06:00", "11:00"],
    act: ["08:43", "10:30"],
    want: ["08:43", "10:30"],
  },
  {
    name: "4. Ra trễ → giờ ca ĐK",
    sch: ["17:00", "21:00"],
    act: ["17:00", "21:40"],
    want: ["17:00", "21:00"],
  },
  {
    name: "Đúng giờ vào/ra",
    sch: ["12:00", "17:00"],
    act: ["12:00", "17:00"],
    want: ["12:00", "17:00"],
  },
];

const screenshot = [
  ["06:00", "11:00", "08:43", "11:01", "08:43", "11:00"],
  ["17:00", "21:00", "17:00", "21:40", "17:00", "21:00"],
  ["06:00", "10:00", "08:44", "10:00", "08:44", "10:00"],
  ["15:00", "21:00", "16:24", "21:40", "16:24", "21:00"],
  ["07:00", "14:00", "08:43", "14:02", "08:43", "14:00"],
  ["12:00", "17:00", "12:06", "17:01", "12:06", "17:00"],
];

let passed = 0;
for (const c of cases) {
  const r = resolveConfirmTimes(c.sch[0], c.sch[1], c.act[0], c.act[1]);
  assertEq(r.checkIn, c.want[0], `${c.name} checkIn`);
  assertEq(r.checkOut, c.want[1], `${c.name} checkOut`);
  passed++;
}

let totalHours = 0;
for (const [ss, se, ai, ao, wi, wo] of screenshot) {
  const r = resolveConfirmTimes(ss, se, ai, ao);
  assertEq(r.checkIn, wi, `screenshot ${ss}-${se} in`);
  assertEq(r.checkOut, wo, `screenshot ${ss}-${se} out`);
  totalHours += calcHours(r.checkIn, r.checkOut);
  passed += 2;
}

const roundedTotal = Math.round(totalHours * 10) / 10;
if (roundedTotal !== 22.3) {
  throw new Error(`Tổng giờ screenshot: expected 22.3, got ${roundedTotal}`);
}
passed++;

console.log(`OK: ${passed} assertions passed`);
console.log(`Tổng giờ xác nhận (ảnh 08/06): ${roundedTotal}h`);
