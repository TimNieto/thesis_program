import { useState } from "react";
import { LoginPage } from "@/app/components/login-page";
import { ScheduleGenerator } from "@/app/components/schedule-generator";
import { CoverApplication } from "@/app/components/cover-application";
import { AdminDashboard } from "@/app/components/admin-dashboard";
import { EmployeeProfile } from "@/app/components/employee-profile";
import { CompanySettings } from "@/app/components/company-settings";
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
} from "lucide-react";
import { Toaster } from "@/app/components/ui/sonner";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState({
    id: 0,
    name: "",
    email: "",
    role: "",
    displayRole: ""
  });

  const handleLogin = (userData: any) => {
  setUser(userData);
};

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser("");
    setUserRole("");
  };

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs
          defaultValue={
            userRole === "admin" ? "admin" : "schedule"
          }
          className="space-y-6"
        >
          <TabsList
            className={`grid w-full ${userRole === "admin" ? "max-w-5xl grid-cols-5" : "max-w-3xl grid-cols-3"}`}
          >
            {userRole === "admin" && (
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
            <TabsTrigger value="profile" className="gap-2">
              <User className="size-4" />
              Profile
            </TabsTrigger>
          </TabsList>

          {userRole === "admin" && (
            <>
              <TabsContent value="admin" className="space-y-4">
                <AdminDashboard currentUser={currentUser} />
              </TabsContent>

              <TabsContent value="settings" className="space-y-4">
                <CompanySettings />
              </TabsContent>
            </>
          )}

          <TabsContent value="schedule" className="space-y-4">
            <ScheduleGenerator
              currentUser={currentUser}
              role={userRole}
            />
          </TabsContent>

          <TabsContent value="cover" className="space-y-4">
            <CoverApplication
              currentUser={currentUser}
              role={userRole}
            />
          </TabsContent>

          <TabsContent value="profile" className="space-y-4">
            <EmployeeProfile
              currentUser={currentUser}
              role={userRole}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}