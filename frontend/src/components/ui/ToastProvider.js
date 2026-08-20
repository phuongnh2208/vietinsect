import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import Icon from "./Icon";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((message, type = "success", duration = 3600) => {
    const id = `${Date.now()}-${Math.random()}`;
    setItems((current) => [...current, { id, message, type }]);
    if (duration > 0) window.setTimeout(() => remove(id), duration);
    return id;
  }, [remove]);

  const value = useMemo(() => ({ toast, remove }), [toast, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="true">
        {items.map((item) => (
          <div key={item.id} className={`toast-card toast-${item.type}`} role="status">
            <span className="toast-icon"><Icon name={item.type === "error" ? "alert" : item.type === "warning" ? "alert" : "check"} size={18} /></span>
            <span className="toast-message">{item.message}</span>
            <button className="icon-button toast-close" onClick={() => remove(item.id)} aria-label="Đóng thông báo"><Icon name="close" size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
