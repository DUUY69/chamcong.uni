export const EDUCATION_LEVEL_OPTIONS = [
  { value: "THPT",       label: "THPT (Lớp 12)" },
  { value: "CaoDang",    label: "Cao đẳng" },
  { value: "DaiHoc",     label: "Đại học" },
  { value: "DaoTaoNghe", label: "Đào tạo nghề" },
];

export function educationLevelLabel(value) {
  if (!value) return "—";
  return EDUCATION_LEVEL_OPTIONS.find(o => o.value === value)?.label ?? "—";
}
