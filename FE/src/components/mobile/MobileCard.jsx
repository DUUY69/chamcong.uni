import { Typography } from "@material-tailwind/react";

export function MobileRow({ label, children, className = "" }) {
  return (
    <div className={`flex justify-between items-start gap-3 text-sm ${className}`}>
      <span className="text-blue-gray-600 font-medium shrink-0 min-w-[6.5rem]">{label}</span>
      <div className="text-blue-gray-900 text-right font-medium flex-1 flex justify-end flex-wrap gap-1">{children}</div>
    </div>
  );
}

export function MobileField({ label, required, children, className = "", prominent = false }) {
  return (
    <div className={className}>
      <label
        className={
          prominent
            ? "text-sm font-semibold text-blue-gray-800 mb-1.5 block"
            : "text-xs font-medium text-blue-gray-700 mb-1 block"
        }
      >
        {label}{required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}

const fieldClass =
  "w-full rounded-lg border border-blue-gray-200 bg-white px-2.5 py-2 text-sm text-blue-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30";

export function MobileTextInput({ value, onChange, type = "text", placeholder = "", step }) {
  return (
    <input type={type} step={step} value={value} placeholder={placeholder} onChange={onChange} className={fieldClass} />
  );
}

export function MobileSelect({ value, onChange, children, multiple, className = "" }) {
  return (
    <select
      multiple={multiple}
      value={value}
      onChange={onChange}
      className={`${fieldClass} ${multiple ? "h-16" : ""} ${className}`}
    >
      {children}
    </select>
  );
}

/** Form tạo/sửa gọn: label trên, lưới nhiều cột */
export function CompactFormPanel({ title, hint, children, onSave, onCancel, saveLabel = "Lưu", columns = "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" }) {
  return (
    <div className="px-4 py-3 border-b bg-blue-50/50">
      {title && (
        <p className="text-sm font-semibold text-blue-gray-900 mb-1">{title}</p>
      )}
      {hint && (
        <p className="text-xs text-blue-gray-600 mb-3 leading-relaxed">{hint}</p>
      )}
      <div className={`grid ${columns} gap-3`}>
        {children}
      </div>
      <div className="flex gap-2 mt-2">
        <button type="button" onClick={onSave}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-gray-900 text-white hover:bg-blue-gray-800">
          {saveLabel}
        </button>
        <button type="button" onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-gray-300 text-blue-gray-700 hover:bg-white">
          Hủy
        </button>
      </div>
    </div>
  );
}

/** Banner lỗi / cảnh báo — hiển thị rõ trên mobile (thay alert). */
export function MobileNotice({ tone = "error", children, onDismiss, className = "" }) {
  const tones = {
    error: "border-red-300 bg-red-50 text-red-900",
    warning: "border-amber-300 bg-amber-50 text-amber-950",
    info: "border-blue-200 bg-blue-50 text-blue-900",
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 text-sm leading-relaxed ${tones[tone] || tones.error} ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">{children}</div>
        {onDismiss ? (
          <button type="button" onClick={onDismiss} className="shrink-0 text-xs font-semibold underline opacity-80">
            Đóng
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function MobileCard({ children, onClick, className = "" }) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full text-left p-4 flex flex-col gap-2.5 hover:bg-blue-gray-50 active:bg-blue-gray-100 ${className}`}
      >
        {children}
      </button>
    );
  }
  return <div className={`p-4 flex flex-col gap-2.5 ${className}`}>{children}</div>;
}

export function MobileListShell({ loading, empty, emptyText, children, count }) {
  if (loading) {
    return <div className="py-12 text-center text-blue-gray-400 text-sm md:hidden">Đang tải...</div>;
  }
  if (empty) {
    return (
      <div className="py-12 text-center px-4 md:hidden">
        <Typography color="gray" className="text-sm">{emptyText}</Typography>
      </div>
    );
  }
  return (
    <>
      {count != null && (
        <div className="px-4 py-2 border-b border-blue-gray-50 md:hidden">
          <Typography variant="small" color="gray">
            Hiển thị <strong>{count}</strong> mục
          </Typography>
        </div>
      )}
      <div className="md:hidden divide-y divide-blue-gray-50">{children}</div>
    </>
  );
}

