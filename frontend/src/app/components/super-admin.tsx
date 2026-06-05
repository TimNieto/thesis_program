import React, { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  Building2,
  Plus,
  Trash2,
  Shield,
  Settings,
  Users,
  ToggleLeft,
  Upload,
  FileSpreadsheet,
  UserSquare2,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  X,
  Download
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
    { id: "1", name: "Live Stream Operations", type: "Live Selling", employeeCount: 45, status: "Active", createdDate: "2025-01-01" },
    { id: "2", name: "Tech Support Center", type: "BPO", employeeCount: 120, status: "Active", createdDate: "2025-02-15" },
    { id: "3", name: "Retail Operations", type: "Retail", employeeCount: 30, status: "Inactive", createdDate: "2024-12-10" },
  ]);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([
    { id: "1", companyId: "1", name: "Auto-Schedule Generation", description: "Automatically generate schedules based on availability", enabled: true, category: "scheduling" },
    { id: "2", companyId: "1", name: "Email Notifications", description: "Send email notifications for schedule changes", enabled: true, category: "notifications" },
    { id: "3", companyId: "1", name: "SMS Alerts", description: "Send SMS alerts for urgent updates", enabled: false, category: "notifications" },
    { id: "4", companyId: "1", name: "Two-Factor Authentication", description: "Require 2FA for admin users", enabled: true, category: "security" },
    { id: "5", companyId: "1", name: "Absence Auto-Replacement", description: "Automatically find replacements for absences", enabled: false, category: "scheduling" },
    { id: "6", companyId: "1", name: "Public Holidays Sync", description: "Automatically block public holidays", enabled: true, category: "general" },
    { id: "7", companyId: "2", name: "Auto-Schedule Generation", description: "Automatically generate schedules based on availability", enabled: false, category: "scheduling" },
    { id: "8", companyId: "2", name: "Email Notifications", description: "Send email notifications for schedule changes", enabled: true, category: "notifications" },
    { id: "9", companyId: "2", name: "SMS Alerts", description: "Send SMS alerts for urgent updates", enabled: true, category: "notifications" },
    { id: "10", companyId: "2", name: "Two-Factor Authentication", description: "Require 2FA for admin users", enabled: false, category: "security" },
    { id: "11", companyId: "2", name: "Absence Auto-Replacement", description: "Automatically find replacements for absences", enabled: true, category: "scheduling" },
    { id: "12", companyId: "2", name: "Public Holidays Sync", description: "Automatically block public holidays", enabled: false, category: "general" },
    { id: "13", companyId: "3", name: "Auto-Schedule Generation", description: "Automatically generate schedules based on availability", enabled: true, category: "scheduling" },
    { id: "14", companyId: "3", name: "Email Notifications", description: "Send email notifications for schedule changes", enabled: false, category: "notifications" },
    { id: "15", companyId: "3", name: "SMS Alerts", description: "Send SMS alerts for urgent updates", enabled: false, category: "notifications" },
    { id: "16", companyId: "3", name: "Two-Factor Authentication", description: "Require 2FA for admin users", enabled: false, category: "security" },
    { id: "17", companyId: "3", name: "Absence Auto-Replacement", description: "Automatically find replacements for absences", enabled: true, category: "scheduling" },
    { id: "18", companyId: "3", name: "Public Holidays Sync", description: "Automatically block public holidays", enabled: true, category: "general" },
  ]);

  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([
    { id: "1", companyId: "1", role: "Admin", canEditCompanySettings: true, canManageEmployees: true, canViewReports: true, canApproveRequests: true },
    { id: "2", companyId: "1", role: "Team Leader (Admin)", canEditCompanySettings: false, canManageEmployees: true, canViewReports: true, canApproveRequests: true },
    { id: "3", companyId: "1", role: "Host", canEditCompanySettings: false, canManageEmployees: false, canViewReports: false, canApproveRequests: false },
    { id: "4", companyId: "1", role: "Operator", canEditCompanySettings: false, canManageEmployees: false, canViewReports: false, canApproveRequests: false },
    { id: "5", companyId: "2", role: "Admin", canEditCompanySettings: true, canManageEmployees: true, canViewReports: true, canApproveRequests: true },
    { id: "6", companyId: "2", role: "Team Leader (Admin)", canEditCompanySettings: true, canManageEmployees: false, canViewReports: true, canApproveRequests: true },
    { id: "7", companyId: "2", role: "Host", canEditCompanySettings: false, canManageEmployees: false, canViewReports: false, canApproveRequests: false },
    { id: "8", companyId: "2", role: "Operator", canEditCompanySettings: false, canManageEmployees: false, canViewReports: true, canApproveRequests: false },
    { id: "9", companyId: "3", role: "Admin", canEditCompanySettings: true, canManageEmployees: true, canViewReports: true, canApproveRequests: true },
    { id: "10", companyId: "3", role: "Team Leader (Admin)", canEditCompanySettings: false, canManageEmployees: true, canViewReports: false, canApproveRequests: false },
    { id: "11", companyId: "3", role: "Host", canEditCompanySettings: false, canManageEmployees: false, canViewReports: false, canApproveRequests: false },
    { id: "12", companyId: "3", role: "Operator", canEditCompanySettings: false, canManageEmployees: false, canViewReports: false, canApproveRequests: false },
  ]);

  // Company Management States
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyType, setNewCompanyType] = useState("Live Selling");

  // Import States
  type ImportStatus = "idle" | "parsing" | "success" | "error";
  type ImportCategory = "employees" | "departments" | "staffing" | "roles";
  interface ImportRecord {
    id: string;
    category: ImportCategory;
    fileName: string;
    rowCount: number;
    importedAt: string;
    status: "success" | "error";
    errors?: string[];
  }
  const [importRecords, setImportRecords] = useState<ImportRecord[]>([]);
  const [importStatuses, setImportStatuses] = useState<Record<ImportCategory, ImportStatus>>({
    employees: "idle",
    departments: "idle",
    staffing: "idle",
    roles: "idle",
  });
  const [importPreviews, setImportPreviews] = useState<Record<ImportCategory, string[][]>>({
    employees: [],
    departments: [],
    staffing: [],
    roles: [],
  });

  const handleFileImport = (category: ImportCategory, file: File) => {
    if (!file) return;
    setImportStatuses((prev) => ({ ...prev, [category]: "parsing" }));
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const rows = text.trim().split("\n").map((r) => r.split(",").map((c) => c.replace(/^"|"$/g, "").trim()));
        if (rows.length < 2) throw new Error("File has no data rows");
        setImportPreviews((prev) => ({ ...prev, [category]: rows.slice(0, 6) }));
        setImportStatuses((prev) => ({ ...prev, [category]: "success" }));
        const record: ImportRecord = {
          id: Date.now().toString(),
          category,
          fileName: file.name,
          rowCount: rows.length - 1,
          importedAt: new Date().toLocaleString(),
          status: "success",
        };
        setImportRecords((prev) => [record, ...prev]);
        toast.success(`Imported ${rows.length - 1} rows from ${file.name}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to parse file";
        setImportStatuses((prev) => ({ ...prev, [category]: "error" }));
        const record: ImportRecord = {
          id: Date.now().toString(),
          category,
          fileName: file.name,
          rowCount: 0,
          importedAt: new Date().toLocaleString(),
          status: "error",
          errors: [msg],
        };
        setImportRecords((prev) => [record, ...prev]);
        toast.error(`Import failed: ${msg}`);
      }
    };
    reader.readAsText(file);
  };

  const clearImport = (category: ImportCategory) => {
    setImportStatuses((prev) => ({ ...prev, [category]: "idle" }));
    setImportPreviews((prev) => ({ ...prev, [category]: [] }));
  };

  // Setting Management States
  const [isAddSettingOpen, setIsAddSettingOpen] = useState(false);
  const [newSettingName, setNewSettingName] = useState("");
  const [newSettingDescription, setNewSettingDescription] = useState("");
  const [newSettingCategory, setNewSettingCategory] = useState<"scheduling" | "notifications" | "security" | "general">("general");

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
      createdDate: new Date().toISOString().split('T')[0],
    };

    // Create default settings for the new company
    const defaultSettings: SystemSetting[] = [
      { id: `${newCompanyId}-1`, companyId: newCompanyId, name: "Auto-Schedule Generation", description: "Automatically generate schedules based on availability", enabled: true, category: "scheduling" },
      { id: `${newCompanyId}-2`, companyId: newCompanyId, name: "Email Notifications", description: "Send email notifications for schedule changes", enabled: true, category: "notifications" },
      { id: `${newCompanyId}-3`, companyId: newCompanyId, name: "SMS Alerts", description: "Send SMS alerts for urgent updates", enabled: false, category: "notifications" },
      { id: `${newCompanyId}-4`, companyId: newCompanyId, name: "Two-Factor Authentication", description: "Require 2FA for admin users", enabled: true, category: "security" },
      { id: `${newCompanyId}-5`, companyId: newCompanyId, name: "Absence Auto-Replacement", description: "Automatically find replacements for absences", enabled: false, category: "scheduling" },
      { id: `${newCompanyId}-6`, companyId: newCompanyId, name: "Public Holidays Sync", description: "Automatically block public holidays", enabled: true, category: "general" },
    ];

    // Create default role permissions for the new company
    const defaultPermissions: RolePermission[] = [
      { id: `${newCompanyId}-1`, companyId: newCompanyId, role: "Admin", canEditCompanySettings: true, canManageEmployees: true, canViewReports: true, canApproveRequests: true },
      { id: `${newCompanyId}-2`, companyId: newCompanyId, role: "Team Leader (Admin)", canEditCompanySettings: false, canManageEmployees: true, canViewReports: true, canApproveRequests: true },
      { id: `${newCompanyId}-3`, companyId: newCompanyId, role: "Host", canEditCompanySettings: false, canManageEmployees: false, canViewReports: false, canApproveRequests: false },
      { id: `${newCompanyId}-4`, companyId: newCompanyId, role: "Operator", canEditCompanySettings: false, canManageEmployees: false, canViewReports: false, canApproveRequests: false },
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
    if (confirm(`Are you sure you want to remove "${name}"? This action cannot be undone.`)) {
      setCompanies(companies.filter((company) => company.id !== id));
      setSystemSettings(systemSettings.filter((setting) => setting.companyId !== id));
      setRolePermissions(rolePermissions.filter((permission) => permission.companyId !== id));
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
          ? { ...company, status: company.status === "Active" ? "Inactive" : "Active" }
          : company
      )
    );
    toast.success("Company status updated");
  };

  // Toggle System Setting
  const toggleSystemSetting = (id: string) => {
    setSystemSettings(
      systemSettings.map((setting) =>
        setting.id === id
          ? { ...setting, enabled: !setting.enabled }
          : setting
      )
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
    value: boolean
  ) => {
    setRolePermissions(
      rolePermissions.map((rp) =>
        rp.id === id ? { ...rp, [permission]: value } : rp
      )
    );
    toast.success("Permission updated");
  };

  const getSettingsByCategory = (category: string) => {
    if (!selectedCompany) return [];
    return systemSettings.filter((s) => s.category === category && s.companyId === selectedCompany.id);
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
        <p className="text-gray-600">Manage companies, system settings, and role permissions</p>
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
                <p className="text-2xl font-bold">{companies.filter((c) => c.status === "Active").length}</p>
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
                <p className="text-2xl font-bold">{companies.reduce((sum, c) => sum + c.employeeCount, 0)}</p>
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
        <TabsList className={`grid w-full ${selectedCompany ? "max-w-4xl grid-cols-4" : "max-w-xs grid-cols-1"}`}>
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
              <TabsTrigger value="imports" className="gap-2">
                <Upload className="size-4" />
                Imports
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
                  <CardDescription>Add, remove, or manage companies in the system</CardDescription>
                </div>
                <Button onClick={() => setIsAddCompanyOpen(true)} className="gap-2">
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
                        <TableCell className="font-medium">{company.name}</TableCell>
                        <TableCell>{company.type}</TableCell>
                        <TableCell>{company.employeeCount}</TableCell>
                        <TableCell>
                          <Badge
                            variant={company.status === "Active" ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => toggleCompanyStatus(company.id)}
                          >
                            {company.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(company.createdDate).toLocaleDateString()}</TableCell>
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
                              onClick={() => handleRemoveCompany(company.id, company.name)}
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
                  <p>Please select a company from the Companies tab to manage its settings</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>System Settings - {selectedCompany?.name}</CardTitle>
                    <CardDescription>Configure system settings and features for this company</CardDescription>
                  </div>
                  <Button onClick={() => setIsAddSettingOpen(true)} className="gap-2">
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
                    <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor={`setting-${setting.id}`} className="font-medium">
                          {setting.name}
                        </Label>
                        <p className="text-sm text-gray-600">{setting.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`setting-${setting.id}`}
                          checked={setting.enabled}
                          onCheckedChange={() => toggleSystemSetting(setting.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSetting(setting.id, setting.name)}
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
                    <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor={`setting-${setting.id}`} className="font-medium">
                          {setting.name}
                        </Label>
                        <p className="text-sm text-gray-600">{setting.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`setting-${setting.id}`}
                          checked={setting.enabled}
                          onCheckedChange={() => toggleSystemSetting(setting.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSetting(setting.id, setting.name)}
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
                    <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor={`setting-${setting.id}`} className="font-medium">
                          {setting.name}
                        </Label>
                        <p className="text-sm text-gray-600">{setting.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`setting-${setting.id}`}
                          checked={setting.enabled}
                          onCheckedChange={() => toggleSystemSetting(setting.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSetting(setting.id, setting.name)}
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
                    <div key={setting.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <Label htmlFor={`setting-${setting.id}`} className="font-medium">
                          {setting.name}
                        </Label>
                        <p className="text-sm text-gray-600">{setting.description}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`setting-${setting.id}`}
                          checked={setting.enabled}
                          onCheckedChange={() => toggleSystemSetting(setting.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSetting(setting.id, setting.name)}
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
              <CardDescription>Configure what each role can access and modify within this company</CardDescription>
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
                              updateRolePermission(rp.id, "canEditCompanySettings", value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rp.canManageEmployees}
                            onCheckedChange={(value) =>
                              updateRolePermission(rp.id, "canManageEmployees", value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rp.canViewReports}
                            onCheckedChange={(value) =>
                              updateRolePermission(rp.id, "canViewReports", value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={rp.canApproveRequests}
                            onCheckedChange={(value) =>
                              updateRolePermission(rp.id, "canApproveRequests", value)
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

        {/* Imports Tab */}
        <TabsContent value="imports" className="space-y-6">
          {!selectedCompany ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12 text-gray-500">
                  <Upload className="size-12 mx-auto mb-3 text-gray-400" />
                  <p>Please select a company from the Companies tab to manage its imports</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-6">
                {(
                  [
                    {
                      key: "employees" as ImportCategory,
                      label: "Employee Data",
                      icon: <Users className="size-5 text-blue-600" />,
                      description: "Import employee profiles including names, IDs, contact info, and hire dates.",
                      templateHeaders: "employee_id,first_name,last_name,email,phone,hire_date,position,department",
                    },
                    {
                      key: "departments" as ImportCategory,
                      label: "Account / Department Data",
                      icon: <Briefcase className="size-5 text-purple-600" />,
                      description: "Import account or department records such as department codes, names, and managers.",
                      templateHeaders: "department_id,department_name,account_code,manager_name,head_count",
                    },
                    {
                      key: "staffing" as ImportCategory,
                      label: "Staffing Requirements",
                      icon: <FileSpreadsheet className="size-5 text-green-600" />,
                      description: "Import shift staffing requirements per stream and time slot.",
                      templateHeaders: "stream,shift_code,shift_start,shift_end,required_hosts,required_operators",
                    },
                    {
                      key: "roles" as ImportCategory,
                      label: "Roles",
                      icon: <UserSquare2 className="size-5 text-orange-600" />,
                      description: "Import role definitions and access levels for this company.",
                      templateHeaders: "role_id,role_name,role_level,can_manage_schedule,can_approve_requests",
                    },
                  ] as { key: ImportCategory; label: string; icon: React.ReactNode; description: string; templateHeaders: string }[]
                ).map(({ key, label, icon, description, templateHeaders }) => {
                  const status = importStatuses[key];
                  const preview = importPreviews[key];
                  return (
                    <Card key={key}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {icon}
                            <div>
                              <CardTitle className="text-base">{label}</CardTitle>
                              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {status === "success" && (
                              <Badge className="gap-1 bg-green-100 text-green-700 border-green-300">
                                <CheckCircle2 className="size-3" /> Imported
                              </Badge>
                            )}
                            {status === "error" && (
                              <Badge className="gap-1 bg-red-100 text-red-700 border-red-300">
                                <AlertCircle className="size-3" /> Error
                              </Badge>
                            )}
                            {status !== "idle" && (
                              <Button variant="ghost" size="sm" onClick={() => clearImport(key)} className="gap-1 text-gray-500 h-7 px-2">
                                <X className="size-3" /> Clear
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 h-7 text-xs"
                              onClick={() => {
                                const blob = new Blob([templateHeaders + "\n"], { type: "text/csv" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement("a");
                                a.href = url;
                                a.download = `${key}_template.csv`;
                                a.click();
                                URL.revokeObjectURL(url);
                              }}
                            >
                              <Download className="size-3" /> Template
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Existing Data Section */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Existing Data</h4>
                          <div className="overflow-x-auto rounded border bg-gray-50">
                            {key === "employees" ? (
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100 border-b">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Employee ID</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Name</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Email</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Position</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Department</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">EMP001</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">John Doe</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">john.doe@example.com</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Host</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Live Stream Ops</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">EMP002</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Jane Smith</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">jane.smith@example.com</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Operator</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Live Stream Ops</td>
                                  </tr>
                                </tbody>
                              </table>
                            ) : key === "departments" ? (
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100 border-b">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Department ID</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Department Name</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Account Code</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Manager</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Head Count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">DEPT001</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Live Stream Operations</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">ACC-LS-001</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Admin Manager</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">45</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">DEPT002</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Technical Support</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">ACC-TS-002</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Support Lead</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">20</td>
                                  </tr>
                                </tbody>
                              </table>
                            ) : key === "staffing" ? (
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100 border-b">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Stream</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Shift Code</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Shift Time</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Required Hosts</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Required Operators</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Mommypoko</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">GY</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">01:00 - 07:00</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">1</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">1</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Mommypoko</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">AM</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">07:00 - 13:00</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">1</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">1</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Sofy</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">GY</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">01:00 - 07:00</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">1</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">1</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Sofy</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">AM</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">07:00 - 13:00</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">1</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">1</td>
                                  </tr>
                                </tbody>
                              </table>
                            ) : key === "roles" ? (
                              <table className="w-full text-xs">
                                <thead className="bg-gray-100 border-b">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Role ID</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Role Name</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Level</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Manage Schedule</th>
                                    <th className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">Approve Requests</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">ROLE001</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Admin</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">High</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Yes</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Yes</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">ROLE002</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Team Leader (Admin)</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Medium</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Yes</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Yes</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">ROLE003</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Host</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Basic</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">No</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">No</td>
                                  </tr>
                                  <tr className="border-t">
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">ROLE004</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Operator</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">Basic</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">No</td>
                                    <td className="px-3 py-1.5 text-gray-700 whitespace-nowrap">No</td>
                                  </tr>
                                </tbody>
                              </table>
                            ) : (
                              <div className="px-3 py-8 text-center text-gray-400 text-xs">No existing data</div>
                            )}
                          </div>
                        </div>

                        {/* Upload Section */}
                        <div>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Import New Data</h4>
                          {status === "idle" || status === "error" ? (
                            <label className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-200 rounded-lg p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                              <Upload className="size-7 text-gray-400 mb-2" />
                              <span className="text-sm font-medium text-gray-600">Click to upload CSV file</span>
                              <span className="text-xs text-gray-400 mt-1">Only .csv files are supported</span>
                              <input
                                type="file"
                                accept=".csv"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileImport(key, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          ) : status === "parsing" ? (
                            <div className="flex items-center justify-center py-8 gap-3 text-gray-500">
                              <div className="size-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                              <span className="text-sm">Parsing file…</span>
                            </div>
                          ) : (
                            preview.length > 0 && (
                              <div className="overflow-x-auto rounded border">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      {preview[0].map((header, i) => (
                                        <th key={i} className="px-3 py-2 text-left font-medium text-gray-600 whitespace-nowrap">{header}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {preview.slice(1).map((row, ri) => (
                                      <tr key={ri} className="border-t">
                                        {row.map((cell, ci) => (
                                          <td key={ci} className="px-3 py-1.5 text-gray-700 whitespace-nowrap">{cell}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <p className="text-xs text-gray-400 px-3 py-1.5 border-t">Showing up to 5 preview rows</p>
                              </div>
                            )
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Import History */}
              {importRecords.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Import History</CardTitle>
                    <CardDescription>Recent import activity for {selectedCompany.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead>File</TableHead>
                            <TableHead>Rows</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Imported At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importRecords.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell className="capitalize font-medium">{r.category}</TableCell>
                              <TableCell className="text-gray-600 text-xs">{r.fileName}</TableCell>
                              <TableCell>{r.rowCount > 0 ? r.rowCount : "—"}</TableCell>
                              <TableCell>
                                {r.status === "success" ? (
                                  <Badge className="gap-1 bg-green-100 text-green-700 border-green-300 text-xs">
                                    <CheckCircle2 className="size-3" /> Success
                                  </Badge>
                                ) : (
                                  <Badge className="gap-1 bg-red-100 text-red-700 border-red-300 text-xs">
                                    <AlertCircle className="size-3" /> Failed
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-gray-500">{r.importedAt}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
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
            <Button variant="outline" onClick={() => setIsAddCompanyOpen(false)}>
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
              <Select value={newSettingCategory} onValueChange={(value) => setNewSettingCategory(value as "scheduling" | "notifications" | "security" | "general")}>
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
            <Button variant="outline" onClick={() => setIsAddSettingOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSetting}>Add Setting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
