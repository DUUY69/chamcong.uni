import { useState, useEffect } from "react";
import { Card, CardBody, Typography, Button, Chip } from "@material-tailwind/react";
import {
  PlusIcon, PencilIcon, TrashIcon, XMarkIcon,
  MegaphoneIcon, AcademicCapIcon, SparklesIcon, DocumentTextIcon,
  LinkIcon,
} from "@heroicons/react/24/solid";
import api from "@/api";
import { useAuth } from "@/context/AuthContext";
import { useUrlFilters } from "@/utils/urlFilters";
import {
  MobileField, MobileTextInput, MobileSelect, CompactFormPanel,
} from "@/components/mobile/MobileCard";

const ANNOUNCEMENT_FILTER_DEFAULTS = { type: "" };

// ── Constants ─────────────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  Promotion:  { label: "Khuyến mãi",   color: "red",   bg: "bg-red-50",   border: "border-red-200",   text: "text-red-700",   Icon: MegaphoneIcon    },
  Training:   { label: "Đào tạo",      color: "blue",  bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-700",  Icon: AcademicCapIcon  },
  NewProduct: { label: "Sản phẩm mới", color: "green", bg: "bg-green-50", border: "border-green-200", text: "text-green-700", Icon: SparklesIcon     },
  Guideline:  { label: "Hướng dẫn",    color: "amber", bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", Icon: DocumentTextIcon },
};

const typeCfg = (t) => TYPE_CONFIG[t] || { label: t, color: "gray", bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", Icon: DocumentTextIcon };

const EMPTY_FORM = { title: "", content: "", linkUrl: "", announcementType: "Guideline", scope: "AllStores", storeIds: [] };

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ ann, onClose, onEdit, onToggle, onDelete, isAdmin }) {
  if (!ann) return null;
  const cfg = typeCfg(ann.announcementType);
  const Icon = cfg.Icon;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Color stripe header */}
        <div className={`${cfg.bg} ${cfg.border} border-b px-5 pt-5 pb-4`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${cfg.bg} ${cfg.border} border flex items-center justify-center shrink-0`}>
                <Icon className={`w-5 h-5 ${cfg.text}`} />
              </div>
              <div>
                <span className={`text-xs font-semibold ${cfg.text} uppercase tracking-wide`}>{cfg.label}</span>
                {!ann.isActive && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Đã ẩn</span>}
              </div>
            </div>
            <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
              <XMarkIcon className="w-5 h-5 text-blue-gray-500" />
            </button>
          </div>
          <h2 className="text-lg font-bold text-blue-gray-900 mt-3 leading-snug">{ann.title}</h2>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {ann.content && (
            <div className="px-5 py-4 border-b border-blue-gray-50">
              <p className="text-sm text-blue-gray-700 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
            </div>
          )}

          {ann.linkUrl && (
            <div className="px-5 py-4 border-b border-blue-gray-50">
              <a href={ann.linkUrl} target="_blank" rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${cfg.bg} ${cfg.text} ${cfg.border} border hover:brightness-95`}>
                <LinkIcon className="w-4 h-4" />
                Mở liên kết
              </a>
              <p className="text-xs text-blue-gray-400 mt-1.5 break-all">{ann.linkUrl}</p>
            </div>
          )}

          <div className="px-5 py-4 space-y-2.5">
            {isAdmin && (
              <InfoRow label="Phạm vi" value={ann.scope === "AllStores" ? "Tất cả cửa hàng" : ann.storeNames?.join(", ")} />
            )}
            <InfoRow label="Người tạo" value={ann.createdByName || "—"} />
            <InfoRow label="Ngày tạo" value={ann.createdAt} />
            {ann.updatedAt && <InfoRow label="Cập nhật" value={ann.updatedAt} />}
          </div>
        </div>

        {/* Footer actions (admin only) */}
        {isAdmin && (
          <div className="shrink-0 border-t border-blue-gray-100 px-5 py-3 flex gap-2">
            <Button size="sm" variant="outlined" className="flex items-center gap-1.5 normal-case" onClick={() => { onClose(); onEdit(ann); }}>
              <PencilIcon className="w-3.5 h-3.5" /> Sửa
            </Button>
            <Button size="sm" variant="outlined" color={ann.isActive ? "amber" : "green"} className="flex items-center gap-1.5 normal-case" onClick={() => { onToggle(ann); onClose(); }}>
              {ann.isActive ? "Ẩn thông báo" : "Hiện thông báo"}
            </Button>
            <Button size="sm" variant="outlined" color="red" className="flex items-center gap-1.5 normal-case ml-auto" onClick={() => { if (confirm("Xóa thông báo này?")) { onDelete(ann); onClose(); } }}>
              <TrashIcon className="w-3.5 h-3.5" /> Xóa
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-blue-gray-400 w-24 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-blue-gray-700 font-medium flex-1">{value}</span>
    </div>
  );
}

// ── Announcement Card ─────────────────────────────────────────────────────────
function AnnCard({ ann, onOpen, isAdmin, onToggle, onEdit, onDelete }) {
  const cfg = typeCfg(ann.announcementType);
  const Icon = cfg.Icon;

  return (
    <div
      className={`rounded-xl border-l-4 ${cfg.border} bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer flex gap-4 p-4`}
      style={{ borderLeftColor: undefined }}
      onClick={() => onOpen(ann)}
    >
      {/* Left accent + icon */}
      <div className={`w-9 h-9 rounded-lg ${cfg.bg} border ${cfg.border} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className={`w-4 h-4 ${cfg.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-bold ${cfg.text} uppercase tracking-wide`}>{cfg.label}</span>
            {!ann.isActive && <span className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Đã ẩn</span>}
          </div>
          <span className="text-xs text-blue-gray-400 whitespace-nowrap shrink-0">{ann.createdAt?.slice(0, 10)}</span>
        </div>

        <h3 className="font-semibold text-blue-gray-900 text-sm leading-snug mb-1">{ann.title}</h3>

        {ann.content && (
          <p className="text-xs text-blue-gray-500 line-clamp-1 leading-relaxed">{ann.content}</p>
        )}

        <div className="flex items-center gap-3 mt-2">
          {ann.linkUrl && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.text}`}>
              <LinkIcon className="w-3 h-3" /> Có liên kết
            </span>
          )}
          {/* Admin actions */}
          {isAdmin && (
            <div className="flex gap-2 ml-auto" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => onEdit(ann)}>Sửa</button>
              <button type="button" className={`text-xs hover:underline ${ann.isActive ? "text-amber-600" : "text-green-600"}`} onClick={() => onToggle(ann)}>
                {ann.isActive ? "Ẩn" : "Hiện"}
              </button>
              <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => { if (confirm("Xóa thông báo này?")) onDelete(ann); }}>Xóa</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Announcements() {
  const { isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editAnn, setEditAnn] = useState(null);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const { values, setFilter } = useUrlFilters(ANNOUNCEMENT_FILTER_DEFAULTS);
  const filterType = values.type;
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const load = async () => {
    setLoading(true);
    try {
      const [annRes, storeRes] = await Promise.all([
        api.get("/announcements"),
        isAdmin ? api.get("/stores") : Promise.resolve(null),
      ]);
      setAnnouncements(annRes.data.data || []);
      if (storeRes) setStores(storeRes.data.data || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const openNew = () => { setEditAnn(null); setForm({ ...EMPTY_FORM }); setShowForm(true); };
  const openEdit = (ann) => {
    setEditAnn(ann);
    setForm({ title: ann.title, content: ann.content || "", linkUrl: ann.linkUrl || "", announcementType: ann.announcementType, scope: ann.scope, storeIds: ann.storeIds || [] });
    setShowForm(true);
    setDetail(null);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { alert("Tiêu đề không được để trống."); return; }
    if (form.scope === "SpecificStores" && (!form.storeIds || form.storeIds.length === 0)) {
      alert("Vui lòng chọn ít nhất một cửa hàng."); return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(), content: form.content?.trim() || null,
        linkUrl: form.linkUrl?.trim() || null, announcementType: form.announcementType,
        scope: form.scope, storeIds: form.scope === "SpecificStores" ? form.storeIds.map(Number) : [],
      };
      if (editAnn) await api.put(`/announcements/${editAnn.id}`, payload);
      else await api.post("/announcements", payload);
      setShowForm(false); setEditAnn(null); load();
    } catch (e) { alert(e?.response?.data?.message || "Lỗi lưu thông báo"); }
    finally { setSaving(false); }
  };

  const toggleActive = async (ann) => {
    try { await api.patch(`/announcements/${ann.id}/toggle-active`); load(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const deleteAnn = async (ann) => {
    try { await api.delete(`/announcements/${ann.id}`); load(); }
    catch (e) { alert(e?.response?.data?.message || "Lỗi"); }
  };

  const filtered = filterType ? announcements.filter((a) => a.announcementType === filterType) : announcements;

  return (
    <div className="mt-4 space-y-4">
      <DetailModal ann={detail} onClose={() => setDetail(null)}
        onEdit={openEdit} onToggle={toggleActive} onDelete={deleteAnn} isAdmin={isAdmin} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <Typography variant="h5" color="blue-gray">Thông báo nội bộ</Typography>
          <Typography variant="small" color="gray" className="mt-0.5">
            Cập nhật tin tức, chương trình và hướng dẫn từ công ty
          </Typography>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Filter by type */}
          <select value={filterType} onChange={(e) => setFilter("type", e.target.value)}
            className="rounded-lg border border-blue-gray-200 px-3 py-1.5 text-sm bg-white text-blue-gray-700">
            <option value="">Tất cả loại</option>
            {Object.entries(TYPE_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
          {isAdmin && (
            <Button size="sm" className="flex items-center gap-1.5 normal-case" onClick={openNew}>
              <PlusIcon className="w-4 h-4" /> Thêm thông báo
            </Button>
          )}
        </div>
      </div>

      {/* Form panel */}
      {showForm && isAdmin && (
        <Card className="border border-blue-gray-100">
          <CardBody className="p-0">
            <CompactFormPanel
              title={editAnn ? "Chỉnh sửa thông báo" : "Thêm thông báo mới"}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditAnn(null); }}
              saveLabel={saving ? "Đang lưu..." : "Đăng thông báo"}
              columns="grid-cols-1 sm:grid-cols-2"
            >
              <MobileField label="Tiêu đề" required className="sm:col-span-2">
                <MobileTextInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Tiêu đề thông báo..." />
              </MobileField>
              <MobileField label="Loại thông báo" required>
                <MobileSelect value={form.announcementType} onChange={(e) => set("announcementType", e.target.value)}>
                  {Object.entries(TYPE_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
                </MobileSelect>
              </MobileField>
              <MobileField label="Phạm vi gửi" required>
                <MobileSelect value={form.scope} onChange={(e) => set("scope", e.target.value)}>
                  <option value="AllStores">🏪 Tất cả cửa hàng</option>
                  <option value="SpecificStores">Cửa hàng cụ thể...</option>
                </MobileSelect>
              </MobileField>
              {form.scope === "SpecificStores" && (
                <MobileField label="Chọn cửa hàng" required className="sm:col-span-2">
                  <MobileSelect multiple value={form.storeIds?.map(String) || []}
                    onChange={(e) => set("storeIds", Array.from(e.target.selectedOptions, (o) => o.value))}>
                    {stores.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </MobileSelect>
                </MobileField>
              )}
              <MobileField label="Đường dẫn (URL)" className="sm:col-span-2">
                <MobileTextInput value={form.linkUrl} onChange={(e) => set("linkUrl", e.target.value)} placeholder="https://..." />
              </MobileField>
              <MobileField label="Nội dung" className="sm:col-span-2">
                <textarea value={form.content} onChange={(e) => set("content", e.target.value)}
                  rows={4} placeholder="Nội dung chi tiết thông báo..."
                  className="w-full rounded-lg border border-blue-gray-200 bg-white px-2.5 py-2 text-sm text-blue-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
              </MobileField>
            </CompactFormPanel>
          </CardBody>
        </Card>
      )}

      {/* Card grid */}
      {loading ? (
        <div className="py-16 text-center text-blue-gray-400 text-sm">Đang tải thông báo...</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <MegaphoneIcon className="w-12 h-12 text-blue-gray-200 mx-auto mb-3" />
          <p className="text-blue-gray-400 text-sm">Chưa có thông báo nào{filterType ? " trong danh mục này" : ""}.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((ann) => (
            <AnnCard key={ann.id} ann={ann} onOpen={setDetail}
              isAdmin={isAdmin} onEdit={openEdit} onToggle={toggleActive} onDelete={deleteAnn} />
          ))}
        </div>
      )}
    </div>
  );
}
