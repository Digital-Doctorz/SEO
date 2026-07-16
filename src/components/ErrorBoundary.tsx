import { useState, useEffect, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

function FallbackUI({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
      <AlertTriangle className="h-12 w-12 text-amber-500" />
      <h3 className="text-lg font-bold text-slate-800">Something went wrong</h3>
      <p className="text-sm text-slate-500 max-w-md">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all cursor-pointer"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

export default function ErrorBoundary({ children, fallback }: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      setHasError(true);
      setErrorMessage(event.message || "An unexpected error occurred.");
      event.preventDefault();
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      setHasError(true);
      setErrorMessage(String(event.reason) || "An unexpected error occurred.");
      event.preventDefault();
    };
    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  if (hasError) {
    if (fallback) return fallback;
    return <FallbackUI message={errorMessage} onRetry={() => { setHasError(false); setErrorMessage(""); }} />;
  }

  try {
    return <>{children}</>;
  } catch (err: any) {
    return <FallbackUI message={err?.message || "An unexpected error occurred."} onRetry={() => {}} />;
  }
}
