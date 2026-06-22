import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AssistantPanelProvider } from "@/widgets/assistant-panel-state";
import Dashboard from "@/layouts/dashboard";
import Auth from "@/layouts/auth";
import Login from "@/pages/auth/Login";

function AppRoutes() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-blue-gray-500">Đang tải...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/auth/*" element={<Auth />} />
      <Route
        path="/dashboard/*"
        element={currentUser ? <Dashboard /> : <Navigate to="/auth/login" replace />}
      />
      <Route path="*" element={<Navigate to={currentUser ? "/dashboard/home" : "/auth/login"} replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AssistantPanelProvider>
        <AppRoutes />
      </AssistantPanelProvider>
    </AuthProvider>
  );
}
