import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertTriangle, Info, X, XCircle } from "lucide-react";

export type ToastKind = "success" | "error" | "warning" | "info";

export interface AppToast {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastHostProps {
  toasts: AppToast[];
  onDismiss: (id: string) => void;
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const STYLES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  error: "border-rose-200 bg-rose-50 text-rose-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-blue-200 bg-blue-50 text-blue-900",
};

/**
 * Lightweight toast host (no new dependency).
 * Non-destructive: mount once in ContentHub / App; does not replace inline alerts.
 */
export default function ToastHost({ toasts, onDismiss }: ToastHostProps) {
  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-[min(100vw-2rem,24rem)] pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: AppToast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[toast.kind];
  useEffect(() => {
    const ms = toast.durationMs ?? (toast.kind === "error" ? 7000 : 4500);
    const timer = setTimeout(() => onDismiss(toast.id), ms);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, toast.kind, onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      className={`pointer-events-auto rounded-xl border shadow-lg p-3.5 flex gap-2.5 ${STYLES[toast.kind]}`}
    >
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="text-xs font-extrabold leading-snug">{toast.title}</div>
        {toast.message && (
          <p className="text-[11px] font-medium mt-0.5 leading-relaxed opacity-90">{toast.message}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 p-0.5 rounded hover:bg-black/5 cursor-pointer"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

export function makeToast(
  kind: ToastKind,
  title: string,
  message?: string,
  durationMs?: number
): AppToast {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    title,
    message,
    durationMs,
  };
}
