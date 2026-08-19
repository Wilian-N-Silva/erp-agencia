"use client";

import { AlertCircle, Check, CheckCircle } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export type ToastTone = "default" | "success" | "error";

export interface ToastInput {
  title: ReactNode;
  description?: ReactNode;
  tone?: ToastTone;
  duration?: number;
}

interface ToastRecord extends ToastInput {
  id: string;
}

type PushToast = (t: ToastInput) => void;

const ToastContext = createContext<PushToast | null>(null);

export function useToast(): PushToast {
  const push = useContext(ToastContext);
  if (!push) throw new Error("useToast must be used within ToastProvider");
  return push;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const push = useCallback<PushToast>((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((xs) => [...xs, { id, ...t }]);
    window.setTimeout(
      () => setToasts((xs) => xs.filter((x) => x.id !== id)),
      t.duration ?? 3800,
    );
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fg-toasts">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`fg-toast fg-toast-${t.tone ?? "default"}`}
            role={t.tone === "error" ? "alert" : "status"}
          >
            <span className="fg-toast-icon">
              {t.tone === "success" ? (
                <CheckCircle size={16} />
              ) : t.tone === "error" ? (
                <AlertCircle size={16} />
              ) : (
                <Check size={16} />
              )}
            </span>
            <div>
              <div className="fg-toast-title">{t.title}</div>
              {t.description && <div className="fg-toast-desc">{t.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
