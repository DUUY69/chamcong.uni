import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const OPEN_KEY = "cc_assistant_panel_open_v1";
const AssistantPanelContext = createContext(null);

function loadOpen() {
  try {
    const v = sessionStorage.getItem(OPEN_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch { /* ignore */ }
  return false;
}

export function AssistantPanelProvider({ children }) {
  const [open, setOpenState] = useState(loadOpen);
  const setOpen = useCallback((value) => {
    setOpenState(value);
    try { sessionStorage.setItem(OPEN_KEY, value ? "1" : "0"); } catch { /* ignore */ }
  }, []);
  const toggle = useCallback(() => setOpen((prev) => !prev), [setOpen]);
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, setOpen, toggle]);
  return <AssistantPanelContext.Provider value={value}>{children}</AssistantPanelContext.Provider>;
}

export function useAssistantPanel() {
  const ctx = useContext(AssistantPanelContext);
  if (!ctx) throw new Error("useAssistantPanel requires provider");
  return ctx;
}

export function assistantPanelMarginClass(open) {
  return open ? "xl:mr-72 2xl:mr-80" : "";
}
