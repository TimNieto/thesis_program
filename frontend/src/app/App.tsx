// ---------------------------------------------------
// src/app/app.tsx

import { useState, useEffect, type ReactNode } from "react";
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

interface AdminTabPermissions {
  adminDashboard: boolean;
  companySettings: boolean;
  scheduleGenerator: boolean;
  coverRequests: boolean;
  reports: boolean;
  profile: boolean;
}

interface EmployeeTabPermissions {
  scheduleGenerator: boolean;
  coverRequests: boolean;
  profile: boolean;
}

interface CompanySettingsSectionPermissions {
  companyProfile: boolean;
  schedulingRules: boolean;
  schedulerScoring: boolean;
  accountSchedulingPolicies: boolean;
  schedulingBehavior: boolean;
  notificationPreferences: boolean;
}

const DEFAULT_ADMIN_TAB_PERMISSIONS: AdminTabPermissions = {
  adminDashboard: true,
  companySettings: true,
  scheduleGenerator: true,
  coverRequests: true,
  reports: true,
  profile: true,
};

const DEFAULT_EMPLOYEE_TAB_PERMISSIONS: EmployeeTabPermissions = {
  scheduleGenerator: true,
  coverRequests: true,
  profile: true,
};

const DEFAULT_COMPANY_SECTION_PERMISSIONS: CompanySettingsSectionPermissions = {
  companyProfile: true,
  schedulingRules: true,
  schedulerScoring: true,
  accountSchedulingPolicies: true,
  schedulingBehavior: true,
  notificationPreferences: true,
};

function PermissionLocked({
  isEnabled,
  children,
}: {
  isEnabled: boolean;
  children: ReactNode;
}) {
  if (isEnabled) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40 grayscale">
        {children}
      </div>

      <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-white/60 pt-10">
        <div className="rounded-md border bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
          This tab is disabled by company permission.
        </div>
      </div>
    </div>
  );
}

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

  const [adminTabPermissions, setAdminTabPermissions] =
    useState<AdminTabPermissions>(DEFAULT_ADMIN_TAB_PERMISSIONS);

  const [employeeTabPermissions, setEmployeeTabPermissions] =
    useState<EmployeeTabPermissions>(DEFAULT_EMPLOYEE_TAB_PERMISSIONS);

  const [companySectionPermissions, setCompanySectionPermissions] =
    useState<CompanySettingsSectionPermissions>(
      DEFAULT_COMPANY_SECTION_PERMISSIONS,
    );

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

    setAdminTabPermissions(DEFAULT_ADMIN_TAB_PERMISSIONS);
    setEmployeeTabPermissions(DEFAULT_EMPLOYEE_TAB_PERMISSIONS);
    setCompanySectionPermissions(DEFAULT_COMPANY_SECTION_PERMISSIONS);
  };

  const fetchCompanyPermissions = async (companyId: number) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/permissions?company_id=${companyId}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load permissions");
      }

      const loadedPermissions = data.rolePermissions || {};

      setAdminTabPermissions({
        ...DEFAULT_ADMIN_TAB_PERMISSIONS,
        ...(loadedPermissions.hrTabs || loadedPermissions.adminTabs || {}),
      });

      setEmployeeTabPermissions({
        ...DEFAULT_EMPLOYEE_TAB_PERMISSIONS,
        ...(loadedPermissions.generalTabs || {}),
      });

      setCompanySectionPermissions({
        ...DEFAULT_COMPANY_SECTION_PERMISSIONS,
        ...(loadedPermissions.companySections || {}),
      });
    } catch (err) {
      console.error("Failed to load company permissions", err);

      setAdminTabPermissions(DEFAULT_ADMIN_TAB_PERMISSIONS);
      setEmployeeTabPermissions(DEFAULT_EMPLOYEE_TAB_PERMISSIONS);
      setCompanySectionPermissions(DEFAULT_COMPANY_SECTION_PERMISSIONS);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (user.role === "super-admin") {
      return;
    }

    if (!user.company_id) {
      return;
    }

    fetchCompanyPermissions(user.company_id);
  }, [isAuthenticated, user.role, user.company_id]);

  const isAdminTabEnabled = (tabKey: keyof AdminTabPermissions) =>
    adminTabPermissions[tabKey] !== false;

  const isEmployeeTabEnabled = (tabKey: keyof EmployeeTabPermissions) =>
    employeeTabPermissions[tabKey] !== false;

  const isScheduleTabEnabled =
    user.role === "admin"
      ? isAdminTabEnabled("scheduleGenerator")
      : isEmployeeTabEnabled("scheduleGenerator");

  const isCoverTabEnabled =
    user.role === "admin"
      ? isAdminTabEnabled("coverRequests")
      : isEmployeeTabEnabled("coverRequests");

  const isProfileTabEnabled =
    user.role === "admin"
      ? isAdminTabEnabled("profile")
      : isEmployeeTabEnabled("profile");

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
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Schedule Manager
                </p>

                <h1 className="text-2xl font-semibold leading-tight">
                  {user.company_name || "No company selected"}
                </h1>

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
                <PermissionLocked
                  isEnabled={isAdminTabEnabled("adminDashboard")}
                >
                  <AdminDashboard currentUser={user} />
                </PermissionLocked>
              </TabsContent>

              <TabsContent value="settings">
                <PermissionLocked
                  isEnabled={isAdminTabEnabled("companySettings")}
                >
                  <CompanySettings
                    currentUser={user}
                    sectionPermissions={companySectionPermissions}
                  />
                </PermissionLocked>
              </TabsContent>

              <TabsContent value="reports">
                <PermissionLocked isEnabled={isAdminTabEnabled("reports")}>
                  <DataReport currentUser={user} />
                </PermissionLocked>
              </TabsContent>
            </>
          )}

          <TabsContent value="schedule">
            <PermissionLocked isEnabled={isScheduleTabEnabled}>
              <ScheduleGenerator
                currentUser={user.email}
                currentUserId={user.id}
                role={user.role}
                companyId={user.company_id}
              />
            </PermissionLocked>
          </TabsContent>

          <TabsContent value="cover">
            <PermissionLocked isEnabled={isCoverTabEnabled}>
              <CoverApplication
                currentUser={{
                  employee_id: user.id,
                  name: user.name,
                  company_id: user.company_id,
                }}
                role={user.role}
              />
            </PermissionLocked>
          </TabsContent>

          <TabsContent value="profile">
            <PermissionLocked isEnabled={isProfileTabEnabled}>
              <EmployeeProfile
                userId={user.id}
                role={user.displayRole}
                onProfileUpdated={() => {
                  console.log("Profile updated");
                }}
              />
            </PermissionLocked>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
