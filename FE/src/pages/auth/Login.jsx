import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Typography, Input, Button } from "@material-tailwind/react";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate("/dashboard/home");
    } catch (err) {
      setError(err?.response?.data?.message || "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-900 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardBody className="p-8">
          <div className="text-center mb-8">
            <Typography variant="h4" color="blue-gray" className="font-bold">Workforce Management</Typography>
            <Typography color="gray" className="mt-1 text-sm">Đăng nhập để tiếp tục</Typography>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Tên đăng nhập"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              autoFocus
            />
            <Input
              type="password"
              label="Mật khẩu"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            {error && (
              <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>
            )}
            <Button type="submit" fullWidth disabled={loading} className="mt-2">
              {loading ? "Đang đăng nhập..." : "Đăng nhập"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
