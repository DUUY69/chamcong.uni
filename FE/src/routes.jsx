import {
  HomeIcon,
  BuildingStorefrontIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  BanknotesIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  MegaphoneIcon,
} from "@heroicons/react/24/solid";

import Home from "@/pages/dashboard/Home";
import Stores from "@/pages/dashboard/Stores";
import Employees from "@/pages/dashboard/Employees";
import ShiftRegistrations from "@/pages/dashboard/ShiftRegistrations";
import Attendance from "@/pages/dashboard/Attendance";
import Payroll from "@/pages/dashboard/Payroll";
import PayrollDetail from "@/pages/dashboard/PayrollDetail";
import AdminConfig from "@/pages/dashboard/AdminConfig";
import Profile from "@/pages/dashboard/Profile";
import Announcements from "@/pages/dashboard/Announcements";

const icon = { className: "w-5 h-5 text-inherit" };

export const dashboardRoutesConfig = [
  { path: "/home",                element: <Home />,               name: "Dashboard",      icon: <HomeIcon {...icon} />,                    roles: ["Admin","Manager","Employee"] },
  { path: "/stores",              element: <Stores />,             name: "Cửa hàng",       icon: <BuildingStorefrontIcon {...icon} />,       roles: ["Admin"] },
  { path: "/employees",           element: <Employees />,          name: "Nhân viên",      icon: <UserGroupIcon {...icon} />,               roles: ["Admin","Manager"] },
  { path: "/shift-registrations", element: <ShiftRegistrations />, name: "Đăng ký ca",    icon: <CalendarDaysIcon {...icon} />,            roles: ["Admin","Manager","Employee"] },
  { path: "/attendance",          element: <Attendance />,         name: "Chấm công",      icon: <ClipboardDocumentCheckIcon {...icon} />,  roles: ["Admin","Manager","Employee"] },
  { path: "/payroll",             element: <Payroll />,            name: "Bảng lương",     icon: <BanknotesIcon {...icon} />,               roles: ["Admin","Manager","Employee"] },
  { path: "/payroll/:id",         element: <PayrollDetail />,      name: null,             icon: null,                                      roles: ["Admin","Manager","Employee"] },
  { path: "/announcements",       element: <Announcements />,      name: "Thông báo",      icon: <MegaphoneIcon {...icon} />,               roles: ["Admin","Manager","Employee"] },
  { path: "/profile",             element: <Profile />,            name: "Thông tin",      icon: <UserCircleIcon {...icon} />,              roles: ["Employee"] },
  { path: "/config",              element: <AdminConfig />,        name: "Cấu hình",       icon: <Cog6ToothIcon {...icon} />,               roles: ["Admin"] },
];

/** role = vai trò hiệu lực (Manager ở chế độ NV → "Employee"). */
export function getRoutesForRole(role) {
  if (!role) return [];
  return dashboardRoutesConfig.filter((r) => r.name && r.roles.includes(role));
}
