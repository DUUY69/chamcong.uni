/** Tự chèn ":" khi gõ số (mobile): 0600 → 06:00 */
export function formatTimeInput(raw) {
  const digits = String(raw ?? "").replace(/[^\d]/g, "").slice(0, 4);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/**
 * Chuẩn hóa giờ HH:mm (24h).
 * Chấp nhận: 06:00, 6:0, 0600, 600 → 06:00
 */
export function toTime24(val) {
  if (val == null || val === "") return "";

  const trimmed = String(val).trim();
  const colon = trimmed.match(/^(\d{1,2}):(\d{1,2})$/);
  if (colon) {
    const h = Math.min(23, Math.max(0, parseInt(colon[1], 10)));
    const min = Math.min(59, Math.max(0, parseInt(colon[2], 10)));
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  const digits = trimmed.replace(/[^\d]/g, "");
  if (!digits) return "";

  if (digits.length <= 2) {
    const h = Math.min(23, Math.max(0, parseInt(digits, 10)));
    if (Number.isNaN(h)) return "";
    return `${String(h).padStart(2, "0")}:00`;
  }

  const h = Math.min(23, Math.max(0, parseInt(digits.slice(0, -2), 10)));
  const min = Math.min(59, Math.max(0, parseInt(digits.slice(-2), 10)));
  if (Number.isNaN(h) || Number.isNaN(min)) return "";
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function isValidTime24(val) {
  const t = toTime24(val);
  return /^\d{2}:\d{2}$/.test(t);
}

/** Input giờ 24h — gõ 0600 hoặc 06:00 đều được (mobile). */
export function TimeInput24({ value, onChange, className = "", disabled = false }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      placeholder="06:00"
      maxLength={5}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(formatTimeInput(e.target.value))}
      onBlur={() => {
        const n = toTime24(value);
        if (n) onChange(n);
      }}
      className={className}
      autoComplete="off"
    />
  );
}
