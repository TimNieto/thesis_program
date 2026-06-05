import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  Building2,
  Plus,
  Trash2,
  Shield,
  Settings,
  Users,
  ToggleLeft,
} from "lucide-react";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  type: string;
  employeeCount: number;
  status: "Active" | "Inactive";
  createdDate: string;
}

interface SystemSetting {
  id: string;
  companyId: string;
  name: string;
  description: string;
  enabled: boolean;
  category: "scheduling" | "notifications" | "security" | "general";
}

interface RolePermission {
  id: string;
  companyId: string;
  role: "Admin" | "Team Leader (Admin)" | "Host" | "Operator";
  canEditCompanySettings: boolean;
  canManageEmployees: boolean;
  canViewReports: boolean;
  canApproveRequests: boolean;
}

export function SuperAdmin() {
  const [companies, setCompanies] = useState<Company[]>([
    {
      id: "1",
      name: "Live Stream Operations",
      type: "Live Selling",
      employeeCount: 45,
      status: "Active",
      createdDate: "2025-01-01",
    },
    {
      id: "2",
      name: "Tech Support Center",
      type: "BPO",
      employeeCount: 120,
      status: "Active",
      createdDate: "2025-02-15",
    },
    {
      id: "3",
      name: "Retail Operations",
      type: "Retail",
      employeeCount: 30,
      status: "Inactive",
      createdDate: "2024-12-10",
    },
  ]);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([
    {
      id: "1",
      companyId: "1",
      name: "Auto-Schedule Generation",
      description: "Automatically generate schedules based on availability",
      enabled: true,
      category: "scheduling",
    },
    {
      id: "2",
      companyId: "1",
      name: "Email Notifications",
      description: "Send email notifications for schedule changes",
      enabled: true,
      category: "notifications",
    },
    {
      id: "3",
      companyId: "1",
      name: "SMS Alerts",
      description: "Send SMS alerts for urgent updates",
      enabled: false,
      category: "notifications",
    },
    {
      id: "4",
      companyId: "1",
      name: "Two-Factor Authentication",
      description: "Require 2FA for admin users",
      enabled: true,
      category: "security",
    },
    {
      id: "5",
      companyId: "1",
      name: "Absence Auto-Replacement",
      description: "Automatically find replacements for absences",
      enabled: false,
      category: "scheduling",
    },
    {
      id: "6",
      companyId: "1",
      name: "Public Holidays Sync",
      description: "Automatically block public holidays",
      enabled: true,
      category: "general",
    },
    {
      id: "7",
      companyId: "2",
      name: "Auto-Schedule Generation",
      description: "Automatically generate schedules based on availability",
      enabled: false,
      category: "scheduling",
    },
    {
      id: "8",
      companyId: "2",
      name: "Email Notifications",
      description: "Send email notifications for schedule changes",
      enabled: true,
      category: "notifications",
    },
    {
      id: "9",
      companyId: "2",
      name: "SMS Alerts",
      description: "Send SMS alerts for urgent updates",
      enabled: true,
      category: "notifications",
    },
    {
      id: "10",
      companyId: "2",
      name: "Two-Factor Authentication",
      description: "Require 2FA for admin users",
      enabled: false,
      category: "security",
    },
    {
      id: "11",
      companyId: "2",
      name: "Absence Auto-Replacement",
      description: "Automatically find replacements for absences",
      enabled: true,
      category: "scheduling",
    },
    {
      id: "12",
      companyId: "2",
      name: "Public Holidays Sync",
      description: "Automatically block public holidays",
      enabled: false,
      category: "general",
    },
    {
      id: "13",
      companyId: "3",
      name: "Auto-Schedule Generation",
      description: "Automatically generate schedules based on availability",
      enabled: true,
      category: "scheduling",
    },
    {
      id: "14",
      companyId: "3",
      name: "Email Notifications",
      description: "Send email notifications for schedule changes",
      enabled: false,
      category: "notifications",
    },
    {
      id: "15",
      companyId: "3",
      name: "SMS Alerts",
      description: "Send SMS alerts for urgent updates",
      enabled: false,
      category: "notifications",
    },
    {
      id: "16",
      companyId: "3",
      name: "Two-Factor Authentication",
      description: "Require 2FA for admin users",
      enabled: false,
      category: "security",
    },
    {
      id: "17",
      companyId: "3",
      name: "Absence Auto-Replacement",
      description: "Automatically find replacements for absences",
      enabled: true,
      category: "scheduling",
    },
    {
      id: "18",
      companyId: "3",
      name: "Public Holidays Sync",
      description: "Automatically block public holidays",
      enabled: true,
      category: "general",
    },
  ]);

  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([
    {
      id: "1",
      companyId: "1",
      role: "Admin",
      canEditCompanySettings: true,
      canManageEmployees: true,
      canViewReports: true,
      canApproveRequests: true,
    },
    {
      id: "2",
      companyId: "1",
      role: "Team Leader (Admin)",
      canEditCompanySettings: false,
      canManageEmployees: true,
      canViewReports: true,
      canApproveRequests: true,
    },
    {
      id: "3",
      companyId: "1",
      role: "Host",
      canEditCompanySettings: false,
      canManageEmployees: false,
      canViewReports: false,
      canApproveRequests: false,
    },
    {
      id: "4",
      companyId: "1",
      role: "Operator",
      canEditCompanySettings: false,
      canManageEmployees: false,
      canViewReports: false,
      canApproveRequests: false,
    },
    {
      id: "5",
      companyId: "2",
      role: "Admin",
      canEditCompanySettings: true,
      canManageEmployees: true,
      canViewReports: true,
      canApproveRequests: true,
    },
    {
      id: "6",
      companyId: "2",
      role: "Team Leader (Admin)",
      canEditCompanySettings: true,
      canManageEmployees: false,
      canViewReports: true,
      canApproveRequests: true,
    },
    {
      id: "7",
      companyId: "2",
      role: "Host",
      canEditCompanySettings: false,
      canManageEmployees: false,
      canViewReports: false,
      canApproveRequests: false,
    },
    {
      id: "8",
      companyId: "2",
      role: "Operator",
      canEditCompanySettings: false,
      canManageEmployees: false,
      canViewReports: true,
      canApproveRequests: false,
    },
    {
      id: "9",
      companyId: "3",
      role: "Admin",
      canEditCompanySettings: true,
      canManageEmployees: true,
      canViewReports: true,
      canApproveRequests: true,
    },
    {
      id: "10",
      companyId: "3",
      role: "Team Leader (Admin)",
      canEditCompanySettings: false,
      canManageEmployees: true,
      canViewReports: false,
      canApproveRequests: false,
    },
    {
      id: "11",
      companyId: "3",
      role: "Host",
      canEditCompanySettings: false,
      canManageEmployees: false,
      canViewReports: false,
      canApproveRequests: false,
    },
    {
      id: "12",
      companyId: "3",
      role: "Operator",
      canEditCompanySettings: false,
      canManageEmployees: false,
      canViewReports: false,
      canApproveRequests: false,
    },
  ]);

  // Company Management States
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyType, setNewCompanyType] = useState("Live Selling");

  // Setting Management States
  const [isAddSettingOpen, setIsAddSettingOpen] = useState(false);
  const [newSettingName, setNewSettingName] = useState("");
  const [newSettingDescription, setNewSettingDescription] = useState("");
  const [newSettingCategory, setNewSettingCategory] = useState<
    "scheduling" | "notifications" | "security" | "general"
  >("general");

  // Add Company
  const handleAddCompany = () => {
    if (!newCompanyName.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    const newCompanyId = Date.now().toString();
    const newCompany: Company = {
      id: newCompanyId,
      name: newCompanyName,
      type: newCompanyType,
      employeeCount: 0,
      status: "Active",
      createdDate: new Date().toISOString().split("T")[0],
    };

    // Create default settings for the new company
    const defaultSettings: SystemSetting[] = [
      {
        id: `${newCompanyId}-1`,
        companyId: newCompanyId,
        name: "Auto-Schedule Generation",
        description: "Automatically generate schedules based on availability",
        enabled: true,
        category: "scheduling",
      },
      {
        id: `${newCompanyId}-2`,
        companyId: newCompanyId,
        name: "Email Notifications",
        description: "Send email notifications for schedule changes",
        enabled: true,
        category: "notifications",
      },
      {
        id: `${newCompanyId}-3`,
        companyId: newCompanyId,
        name: "SMS Alerts",
        description: "Send SMS alerts for urgent updates",
        enabled: false,
        category: "notifications",
      },
      {
        id: `${newCompanyId}-4`,
        companyId: newCompanyId,
        name: "Two-Factor Authentication",
        description: "Require 2FA for admin users",
        enabled: true,
        category: "security",
      },
      {
        id: `${newCompanyId}-5`,
        companyId: newCompanyId,
        name: "Absence Auto-Replacement",
        description: "Automatically find replacements for absences",
        enabled: false,
        category: "scheduling",
      },
      {
        id: `${newCompanyId}-6`,
        companyId: newCompanyId,
        name: "Public Holidays Sync",
        description: "Automatically block public holidays",
        enabled: true,
        category: "general",
      },
    ];

    // Create default role permissions for the new company
    const defaultPermissions: RolePermission[] = [
      {
        id: `${newCompanyId}-1`,
        companyId: newCompanyId,
        role: "Admin",
        canEditCompanySettings: true,
        canManageEmployees: true,
        canViewReports: true,
        canApproveRequests: true,
      },
      {
        id: `${newCompanyId}-2`,
        companyId: newCompanyId,
        role: "Team Leader (Admin)",
        canEditCompanySettings: false,
        canManageEmployees: true,
        canViewReports: true,
        canApproveRequests: true,
      },
      {
        id: `${newCompanyId}-3`,
        companyId: newCompanyId,
        role: "Host",
        canEditCompanySettings: false,
        canManageEmployees: false,
        canViewReports: false,
        canApproveRequests: false,
      },
      {
        id: `${newCompanyId}-4`,
        companyId: newCompanyId,
        role: "Operator",
        canEditCompanySettings: false,
        canManageEmployees: false,
        canViewReports: false,
        canApproveRequests: false,
      },
    ];

    setCompanies([...companies, newCompany]);
    setSystemSettings([...systemSettings, ...defaultSettings]);
    setRolePermissions([...rolePermissions, ...defaultPermissions]);
    setIsAddCompanyOpen(false);
    setNewCompanyName("");
    setNewCompanyType("Live Selling");
    toast.success(`Company "${newCompanyName}" added successfully`);
  };

  // Remove Company
  const handleRemoveCompany = (id: string, name: string) => {
    if (
      confirm(
        `Are you sure you want to remove "${name}"? This action cannot be undone.`,
      )
    ) {
      setCompanies(companies.filter((company) => company.id !== id));
      setSystemSettings(
        systemSettings.filter((setting) => setting.companyId !== id),
      );
      setRolePermissions(
        rolePermissions.filter((permission) => permission.companyId !== id),
      );
      if (selectedCompany?.id === id) {
        setSelectedCompany(null);
      }
      toast.success(`Company "${name}" removed`);
    }
  };

  // Toggle Company Status
  const toggleCompanyStatus = (id: string) => {
    setCompanies(
      companies.map((company) =>
        company.id === id
          ? {
              ...company,
              status: company.status === "Active" ? "Inactive" : "Active",
            }
          : company,
      ),
    );
    toast.success("Company status updated");
  };

  // Toggle System Setting
  const toggleSystemSetting = (id: string) => {
    setSystemSettings(
      systemSettings.map((setting) =>
        setting.id === id ? { ...setting, enabled: !setting.enabled } : setting,
      ),
    );
    toast.success("Setting updated");
  };

  // Add Setting
  const handleAddSetting = () => {
    if (!selectedCompany) {
      toast.error("Please select a company first");
      return;
    }

    if (!newSettingName.trim() || !newSettingDescription.trim()) {
      toast.error("Please enter a setting name and description");
      return;
    }

    const newSetting: SystemSetting = {
      id: Date.now().toString(),
      companyId: selectedCompany.id,
      name: newSettingName,
      description: newSettingDescription,
      enabled: false,
      category: newSettingCategory,
    };

    setSystemSettings([...systemSettings, newSetting]);
    setIsAddSettingOpen(false);
    setNewSettingName("");
    setNewSettingDescription("");
    setNewSettingCategory("general");
    toast.success(`Setting "${newSettingName}" added successfully`);
  };

  // Remove Setting
  const handleRemoveSetting = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove "${name}"?`)) {
      setSystemSettings(systemSettings.filter((setting) => setting.id !== id));
      toast.success(`Setting "${name}" removed`);
    }
  };

  // Update Role Permission
  const updateRolePermission = (
    id: string,
    permission: keyof Omit<RolePermission, "id" | "role">,
    value: boolean,
  ) => {
    setRolePermissions(
      rolePermissions.map((rp) =>
        rp.id === id ? { ...rp, [permission]: value } : rp,
      ),
    );
    toast.success("Permission updated");
  };

  const getSettingsByCategory = (category: string) => {
    if (!selectedCompany) return [];
    return systemSettings.filter(
      (s) => s.category === category && s.companyId === selectedCompany.id,
    );
  };

  const getCompanyRolePermissions = () => {
    if (!selectedCompany) return [];
    return rolePermissions.filter((rp) => rp.companyId === selectedCompany.id);
  };

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    toast.success(`Selected ${company.name}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl">Super Admin Panel</h2>
        <p className="text-gray-600">
          Manage companies, system settings, and role permissions
        </p>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Companies</p>
                <p className="text-2xl font-bold">{companies.length}</p>
              </div>
              <Building2 className="size-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Companies</p>
                <p className="text-2xl font-bold">
                  {companies.filter((c) => c.status === "Active").length}
                </p>
              </div>
              <Building2 className="size-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Employees</p>
                <p className="text-2xl font-bold">
                  {companies.reduce((sum, c) => sum + c.employeeCount, 0)}
                </p>
              </div>
              <Users className="size-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Selected Company Indicator */}
      {selectedCompany && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="size-6 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">Currently Managing</p>
                  <p className="font-medium text-lg">{selectedCompany.name}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setSelectedCompany(null)}
                className="gap-2"
              >
                Back to Companies
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="companies" className="space-y-6">
        <TabsList
          className={`grid w-full ${selectedCompany ? "max-w-3xl grid-cols-3" : "max-w-xs grid-cols-1"}`}
        >
          <TabsTrigger value="companies" className="gap-2">
            <Building2 className="size-4" />
            Companies
          </TabsTrigger>
          {selectedCompany && (
            <>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="size-4" />
                System Settings
              </TabsTrigger>
              <TabsTrigger value="permissions" className="gap-2">
                <Shield className="size-4" />
                Role Permissions
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Company Management</CardTitle>
                  <CardDescription>
                    Add, remove, or manage companies in the system
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setIsAddCompanyOpen(true)}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  Add Company
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Employees</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((company) => (
                      <TableRow key={company.id}>
                        <TableCell className="font-medium">
                          {company.name}
                        </TableCell>
                        <TableCell>{company.type}</TableCell>
                        <TableCell>{company.employeeCount}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              company.status === "Active"
                                ? "default"
                                : "secondary"
                            }
                            className="cursor-pointer"
                            onClick={() => toggleCompanyStatus(company.id)}
                          >
                            {company.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(company.createdDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleSelectCompany(company)}
                              className="gap-2"
                            >
                              <Settings className="size-4" />
                              Manage
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() =>
                                handleRemoveCompany(company.id, company.name)
                              }
                              className="gap-2"
                            >
                              <Trash2 className="size-4" />
                              Remove
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {!selectedCompany ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-gray-500">
                  <Settings className="size-12 mx-auto mb-3 text-gray-400" />
                  <p>
                    Please select a company from the Companies tab to manage its
                    settings
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      System Settings - {selectedCompany?.name}
                    </CardTitle>
                    <CardDescription>
                      Configure system settings and features for this company
                    </CardDescription>
                  </div>
                  <Button
                    onClick={() => setIsAddSettingOpen(true)}
                    className="gap-2"
                  >
                    <Plus className="size-4" />
                    Add Setting
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Scheduling Settings */}
                <div>
                  <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
                    <ToggleLeft className="size-5 text-blue-600" />
                    Scheduling
                  </h3>
                  <div className="space-y-3">
                    {getSettingsByCategory("scheduling").map((setting) => (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1 flex-1">
                          <Label
                            htmlFor={`setting-${setting.id}`}
                            className="font-medium"
                          >
                            {setting.name}
                          </Label>
                          <p className="text-sm text-gray-600">
                            {setting.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`setting-${setting.id}`}
                            checked={setting.enabled}
                            onCheckedChange={() =>
                              toggleSystemSetting(setting.id)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveSetting(setting.id, setting.name)
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notifications Settings */}
                <div>
                  <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
                    <ToggleLeft className="size-5 text-blue-600" />
                    Notifications
                  </h3>
                  <div className="space-y-3">
                    {getSettingsByCategory("notifications").map((setting) => (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1 flex-1">
                          <Label
                            htmlFor={`setting-${setting.id}`}
                            className="font-medium"
                          >
                            {setting.name}
                          </Label>
                          <p className="text-sm text-gray-600">
                            {setting.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`setting-${setting.id}`}
                            checked={setting.enabled}
                            onCheckedChange={() =>
                              toggleSystemSetting(setting.id)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveSetting(setting.id, setting.name)
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security Settings */}
                <div>
                  <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
                    <Shield className="size-5 text-blue-600" />
                    Security
                  </h3>
                  <div className="space-y-3">
                    {getSettingsByCategory("security").map((setting) => (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1 flex-1">
                          <Label
                            htmlFor={`setting-${setting.id}`}
                            className="font-medium"
                          >
                            {setting.name}
                          </Label>
                          <p className="text-sm text-gray-600">
                            {setting.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`setting-${setting.id}`}
                            checked={setting.enabled}
                            onCheckedChange={() =>
                              toggleSystemSetting(setting.id)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveSetting(setting.id, setting.name)
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* General Settings */}
                <div>
                  <h3 className="font-medium text-lg mb-3 flex items-center gap-2">
                    <Settings className="size-5 text-blue-600" />
                    General
                  </h3>
                  <div className="space-y-3">
                    {getSettingsByCategory("general").map((setting) => (
                      <div
                        key={setting.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1 flex-1">
                          <Label
                            htmlFor={`setting-${setting.id}`}
                            className="font-medium"
                          >
                            {setting.name}
                          </Label>
                          <p className="text-sm text-gray-600">
                            {setting.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            id={`setting-${setting.id}`}
                            checked={setting.enabled}
                            onCheckedChange={() =>
                              toggleSystemSetting(setting.id)
                            }
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveSetting(setting.id, setting.name)
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Role Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions - {selectedCompany?.name}</CardTitle>
              <CardDescription>
                Configure what each role can access and modify within this
                company
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Edit Company Settings</TableHead>
                      <TableHead>Manage Employees</TableHead>
                      <TableHead>View Reports</TableHead>
                      <TableHead>Approve Requests</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getCompanyRolePermissions().map((rp) => (
                      <TableRow key={rp.id}>
                        <TableCell className="font-medium">
                          <Badge variant="outline">{rp.role}</Badge>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rp.canEditCompanySettings}
                            onCheckedChange={(value) =>
                              updateRolePermission(
                                rp.id,
                                "canEditCompanySettings",
                                value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rp.canManageEmployees}
                            onCheckedChange={(value) =>
                              updateRolePermission(
                                rp.id,
                                "canManageEmployees",
                                value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rp.canViewReports}
                            onCheckedChange={(value) =>
                              updateRolePermission(
                                rp.id,
                                "canViewReports",
                                value,
                              )
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rp.canApproveRequests}
                            onCheckedChange={(value) =>
                              updateRolePermission(
                                rp.id,
                                "canApproveRequests",
                                value,
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Company Dialog */}
      <Dialog open={isAddCompanyOpen} onOpenChange={setIsAddCompanyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
            <DialogDescription>
              Enter company details to add a new company to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                placeholder="Enter company name"
                value={newCompanyName}
                onChange={(e) => setNewCompanyName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddCompany();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyType">Company Type</Label>
              <Select value={newCompanyType} onValueChange={setNewCompanyType}>
                <SelectTrigger id="companyType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Live Selling">Live Selling</SelectItem>
                  <SelectItem value="BPO">BPO</SelectItem>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Healthcare">Healthcare</SelectItem>
                  <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddCompanyOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddCompany}>Add Company</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Setting Dialog */}
      <Dialog open={isAddSettingOpen} onOpenChange={setIsAddSettingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Setting</DialogTitle>
            <DialogDescription>
              Add a new system setting for {selectedCompany?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="settingName">Setting Name</Label>
              <Input
                id="settingName"
                placeholder="Enter setting name"
                value={newSettingName}
                onChange={(e) => setNewSettingName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settingDescription">Description</Label>
              <Input
                id="settingDescription"
                placeholder="Enter setting description"
                value={newSettingDescription}
                onChange={(e) => setNewSettingDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settingCategory">Category</Label>
              <Select
                value={newSettingCategory}
                onValueChange={(value) =>
                  setNewSettingCategory(
                    value as
                      | "scheduling"
                      | "notifications"
                      | "security"
                      | "general",
                  )
                }
              >
                <SelectTrigger id="settingCategory">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduling">Scheduling</SelectItem>
                  <SelectItem value="notifications">Notifications</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddSettingOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddSetting}>Add Setting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
