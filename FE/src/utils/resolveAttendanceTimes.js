/** Gợi ý giờ QL xác nhận — khớp AttendanceRules.ResolveFinalTimes (BE). */
function parseMinutes(t) {
  const [h, m] = String(t || "00:00").slice(0, 5).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function fromMinutes(m) {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function resolveConfirmTimes(scheduledStart, scheduledEnd, actualIn, actualOut) {
  const schIn = parseMinutes(scheduledStart);
  const schOut = parseMinutes(scheduledEnd);
  const actIn = parseMinutes(actualIn);
  const actOut = parseMinutes(actualOut);

  // Vào sớm → ca ĐK; vào trễ → giờ thực
  const confirmIn = actIn < schIn ? schIn : actIn;
  // Ra sớm → giờ thực; ra trễ → ca ĐK
  let confirmOut = actOut >= schOut ? schOut : actOut;
  if (confirmOut <= confirmIn) confirmOut = actOut > confirmIn ? actOut : schOut;

  return {
    checkIn: fromMinutes(confirmIn),
    checkOut: fromMinutes(confirmOut),
  };
}
