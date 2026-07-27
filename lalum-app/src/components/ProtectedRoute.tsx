import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LangContext";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLang();
  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "grid", placeItems: "center", color: "var(--slate)" }}>
        {t.ui.loading}
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
