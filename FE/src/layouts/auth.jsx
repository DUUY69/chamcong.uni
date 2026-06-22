import { Routes, Route } from "react-router-dom";
import Login from "@/pages/auth/Login";

export default function Auth() {
  return (
    <div className="min-h-screen bg-blue-gray-50">
      <Routes>
        <Route path="login" element={<Login />} />
      </Routes>
    </div>
  );
}
