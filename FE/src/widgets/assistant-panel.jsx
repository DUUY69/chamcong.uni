import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Typography, IconButton, Input, Spinner } from "@material-tailwind/react";
import { PaperAirplaneIcon, SparklesIcon, TrashIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import api from "@/api";
import { useAssistantPanel } from "@/widgets/assistant-panel-state";

const STORAGE_KEY = "cc_assistant_chat_v1";
const STARTER_HINTS = [
  "Xin chào",
  "Bạn có thể làm gì?",
  "Hôm nay em chấm chưa?",
  "Ai trễ hôm nay?",
  "Ca chờ duyệt",
];

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadMessages() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function AssistantPanel() {
  const { open, setOpen } = useAssistantPanel();
  const navigate = useNavigate();
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)));
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text ?? "").trim();
    if (!trimmed || sending) return;
    setMessages((prev) => [...prev, { id: makeId(), role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    try {
      const res = await api.post("/assistant/chat", { message: trimmed, system: "chamcong" });
      const data = res.data?.data ?? res.data;
      setMessages((prev) => [
        ...prev,
        {
          id: makeId(),
          role: "assistant",
          text: data?.reply || "Không có phản hồi.",
          actionUrl: data?.actionUrl,
          rows: data?.rows,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { id: makeId(), role: "assistant", text: e?.response?.data?.message || "Lỗi kết nối trợ lý." },
      ]);
    } finally {
      setSending(false);
    }
  }, [sending]);

  const clearChat = () => {
    setMessages([]);
    sessionStorage.removeItem(STORAGE_KEY);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[45] bottom-[4.75rem] right-4 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg xl:bottom-auto xl:top-1/2 xl:-translate-y-1/2 xl:right-0 xl:rounded-l-xl xl:rounded-r-none xl:h-auto xl:w-auto xl:px-2 xl:py-3"
        title="Mở Trợ lý CH"
      >
        <SparklesIcon className="w-6 h-6 mx-auto" />
        <span className="hidden xl:block text-[10px] font-semibold mt-1">Trợ lý</span>
      </button>
    );
  }

  return (
    <aside className="fixed z-[46] flex flex-col bg-white border border-blue-gray-100 shadow-xl
      inset-x-0 bottom-0 h-[min(70vh,520px)] rounded-t-2xl
      xl:inset-auto xl:top-0 xl:right-0 xl:bottom-0 xl:h-full xl:w-72 xl:2xl:w-80 xl:rounded-none xl:border-l">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-blue-600 text-white rounded-t-2xl xl:rounded-none">
        <div className="flex items-center gap-2">
          <SparklesIcon className="w-5 h-5" />
          <Typography variant="small" className="font-bold text-white">Trợ lý CH</Typography>
        </div>
        <div className="flex gap-1">
          <IconButton variant="text" className="text-white/90" onClick={clearChat} title="Xóa chat">
            <TrashIcon className="w-4 h-4" />
          </IconButton>
          <IconButton variant="text" className="text-white" onClick={() => setOpen(false)}>
            <ChevronRightIcon className="w-5 h-5" />
          </IconButton>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
        {messages.length === 0 && (
          <div className="text-blue-gray-500 text-xs space-y-2">
            <p>Gợi ý câu hỏi:</p>
            <div className="flex flex-wrap gap-1">
              {STARTER_HINTS.map((h) => (
                <button key={h} type="button" onClick={() => sendMessage(h)}
                  className="px-2 py-1 rounded-full bg-blue-gray-50 border text-blue-gray-700 text-xs">
                  {h}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 whitespace-pre-wrap ${
              m.role === "user" ? "bg-blue-600 text-white" : "bg-blue-gray-50 text-blue-gray-800"
            }`}>
              {m.text}
              {m.rows?.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.rows.map((row, i) => (
                    <button key={i} type="button"
                      onClick={() => row.link && navigate(`/dashboard${row.link.replace(/^\/dashboard/, "")}`)}
                      className="block w-full text-left text-xs rounded border bg-white px-2 py-1 hover:bg-blue-50">
                      <div className="font-semibold">{row.title}</div>
                      {row.subtitle && <div className="text-blue-gray-500">{row.subtitle}</div>}
                    </button>
                  ))}
                </div>
              )}
              {m.actionUrl && (
                <button type="button"
                  onClick={() => navigate(`/dashboard${m.actionUrl.replace(/^\/dashboard/, "")}`)}
                  className="mt-2 text-xs underline text-blue-700">
                  Mở trang liên quan
                </button>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-blue-gray-500 text-xs">
            <Spinner className="h-4 w-4" /> Đang trả lời…
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
        className="p-2 border-t flex gap-2 safe-area-bottom">
        <Input crossOrigin={undefined} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Hỏi trợ lý chấm công…" className="!text-sm" disabled={sending} />
        <IconButton type="submit" disabled={sending || !input.trim()} color="blue">
          <PaperAirplaneIcon className="w-4 h-4" />
        </IconButton>
      </form>
    </aside>
  );
}
