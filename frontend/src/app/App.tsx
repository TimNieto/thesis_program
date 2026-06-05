// src/app/app.tsx

import { useState } from "react";
import { LoginPage } from "@/app/components/login-page";
import { ScheduleGenerator } from "@/app/components/schedule-generator";
import { CoverApplication } from "@/app/components/cover-application";
import { AdminDashboard } from "@/app/components/admin-dashboard";
import { EmployeeProfile } from "@/app/components/employee-profile";
import { CompanySettings } from "@/app/components/company-settings";
import { NotificationBell } from "@/app/components/notification-bell";
import { DataReport } from "@/app/components/data-report";
import { SuperAdmin } from "@/app/components/super-admin";
import { Button } from "@/app/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  Calendar,
  ClipboardList,
  LogOut,
  LayoutDashboard,
  User,
  Settings,
  Shield,
  BarChart3,
} from "lucide-react";
import { Toaster } from "@/app/components/ui/sonner";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({
    id: 0,
    name: "",
    email: "",
    role: "",
    displayRole: "",
    company_id: null as number | null,
    company_name: null as string | null,
  });

  const handleLogin = (userData: any) => {
    console.log("LOGIN USER:", userData);
    setUser(userData);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser({
      id: 0,
      name: "",
      email: "",
      role: "",
      displayRole: "",
      company_id: null,
      company_name: null,
    });
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (user.role === "super-admin") {
    return (
      <div className="size-full bg-gray-50">
        <Toaster />

        <header className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="size-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl">Super Admin Panel</h1>
                  <p className="text-sm text-gray-600">
                    Welcome, {user.name} ({user.displayRole})
                  </p>
                </div>
              </div>

              <Button
                onClick={handleLogout}
                variant="outline"
                className="gap-2"
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <SuperAdmin />
        </main>
      </div>
    );
  }

  return (
    <div className="size-full bg-gray-50">
      <Toaster />

      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="size-8 text-blue-600" />
              <div>
                <h1 className="text-2xl">Schedule Manager</h1>
                <p className="text-sm text-gray-600">
                  Welcome, {user.name} ({user.displayRole})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell employeeId={user.id} />

              <Button
                onClick={handleLogout}
                variant="outline"
                className="gap-2"
              >
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs
          defaultValue={user.role === "admin" ? "admin" : "schedule"}
          className="space-y-6"
        >
          <TabsList
            className={`grid w-full ${
              user.role === "admin"
                ? "max-w-5xl grid-cols-6"
                : "max-w-3xl grid-cols-3"
            }`}
          >
            {user.role === "admin" && (
              <>
                <TabsTrigger value="admin" className="gap-2">
                  <LayoutDashboard className="size-4" />
                  Admin Dashboard
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="size-4" />
                  Company Settings
                </TabsTrigger>
              </>
            )}

            <TabsTrigger value="schedule" className="gap-2">
              <Calendar className="size-4" />
              Schedule Generator
            </TabsTrigger>

            <TabsTrigger value="cover" className="gap-2">
              <ClipboardList className="size-4" />
              Cover Requests
            </TabsTrigger>

            {user.role === "admin" && (
              <TabsTrigger value="reports" className="gap-2">
                <BarChart3 className="size-4" />
                Reports
              </TabsTrigger>
            )}

            <TabsTrigger value="profile" className="gap-2">
              <User className="size-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          {user.role === "admin" && (
            <>
              <TabsContent value="admin">
                <AdminDashboard currentUser={user} />
              </TabsContent>

              <TabsContent value="settings">
                <CompanySettings currentUser={user} />
              </TabsContent>

              <TabsContent value="reports">
                <DataReport />
              </TabsContent>
            </>
          )}

          <TabsContent value="schedule">
            <ScheduleGenerator
              currentUser={user.email}
              currentUserId={user.id}
              role={user.role}
              companyId={user.company_id}
            />
          </TabsContent>

          <TabsContent value="cover">
            <CoverApplication
              currentUser={{
                employee_id: user.id,
                name: user.name,
              }}
              role={user.role}
            />
          </TabsContent>

          <TabsContent value="profile">
            <EmployeeProfile
              userId={user.id}
              role={user.displayRole}
              onProfileUpdated={() => {
                console.log("Profile updated");
              }}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
