// ---------------------------------------------------
// src/app/components/super-admin.tsx

import React, { useState, useEffect } from "react";
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
import { Building2, Plus, Trash2, Shield, Settings, Users } from "lucide-react";
import { toast } from "sonner";
import { CompanySettings } from "@/app/components/company-settings";

interface Company {
  id: string;
  name: string;
  type: string;
  employeeCount: number;
  status: "Active" | "Inactive";
  createdDate: string;
}

interface RolePermissionsState {
  hrTabs: {
    adminDashboard: boolean;
    companySettings: boolean;
    scheduleGenerator: boolean;
    coverRequests: boolean;
    reports: boolean;
    profile: boolean;
  };
  generalTabs: {
    scheduleGenerator: boolean;
    coverRequests: boolean;
    profile: boolean;
  };
  companySections: {
    companyProfile: boolean;
    schedulingRules: boolean;
    schedulerScoring: boolean;
    accountSchedulingPolicies: boolean;
    schedulingBehavior: boolean;
    notificationPreferences: boolean;
  };
}

const DEFAULT_ROLE_PERMISSIONS: RolePermissionsState = {
  hrTabs: {
    adminDashboard: true,
    companySettings: true,
    scheduleGenerator: true,
    coverRequests: true,
    reports: true,
    profile: true,
  },
  generalTabs: {
    scheduleGenerator: true,
    coverRequests: true,
    profile: true,
  },
  companySections: {
    companyProfile: true,
    schedulingRules: true,
    schedulerScoring: true,
    accountSchedulingPolicies: true,
    schedulingBehavior: true,
    notificationPreferences: true,
  },
};

export function SuperAdmin() {
  const [companies, setCompanies] = useState<Company[]>([]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/companies",
      );

      const data = await res.json();

      setCompanies(
        Array.isArray(data)
          ? data
              .filter((company: any) => company.is_active)
              .map((company: any) => ({
                id: String(company.company_id),
                name: company.company_name,
                type: company.company_type || "Live Selling",
                employeeCount: Number(company.employee_count || 0),
                status: "Active",
                createdDate: company.created_at,
              }))
          : [],
      );
    } catch (err) {
      console.error("Failed to load companies", err);
      setCompanies([]);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  const [activeTab, setActiveTab] = useState("companies");

  const [rolePermissions, setRolePermissions] = useState<RolePermissionsState>(
    DEFAULT_ROLE_PERMISSIONS,
  );

  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  // Company Management States
  const [isAddCompanyOpen, setIsAddCompanyOpen] = useState(false);
  const [companyToRemove, setCompanyToRemove] = useState<Company | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newCompanyType, setNewCompanyType] = useState("Live Selling");

  // Add Company
  const handleAddCompany = async () => {
    if (!newCompanyName.trim()) {
      toast.error("Please enter a company name");
      return;
    }

    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/companies",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_name: newCompanyName.trim(),
            company_type: newCompanyType,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to create company");
      }

      await fetchCompanies();

      setIsAddCompanyOpen(false);
      setNewCompanyName("");
      setNewCompanyType("Live Selling");

      toast.success(
        data.message || `Company "${newCompanyName}" added successfully`,
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create company",
      );
    }
  };

  // Remove Company
  const handleRemoveCompany = (id: string, name: string) => {
    const company = companies.find((item) => item.id === id);

    setCompanyToRemove(
      company || {
        id,
        name,
        type: "",
        employeeCount: 0,
        status: "Active",
        createdDate: "",
      },
    );
  };

  const confirmRemoveCompany = async () => {
    if (!companyToRemove) {
      return;
    }

    const company = companyToRemove;

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/companies/${company.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to remove company");
      }

      await fetchCompanies();

      if (selectedCompany?.id === company.id) {
        setSelectedCompany(null);
        setActiveTab("companies");
      }

      setCompanyToRemove(null);

      toast.success(`Company "${company.name}" removed`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove company",
      );
    }
  };

  // Toggle Company Status
  const toggleCompanyStatus = async (id: string) => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/companies/${id}/toggle-status`,
        {
          method: "PUT",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to update company status");
      }

      await fetchCompanies();
      toast.success("Company status updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update company status",
      );
    }
  };

  const fetchPermissions = async (companyId: string) => {
    try {
      setLoadingPermissions(true);

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/permissions?company_id=${companyId}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load permissions");
      }

      const loadedPermissions = data.rolePermissions || {};

      setRolePermissions({
        hrTabs: {
          ...DEFAULT_ROLE_PERMISSIONS.hrTabs,
          ...(loadedPermissions.hrTabs || loadedPermissions.adminTabs || {}),
        },
        generalTabs: {
          ...DEFAULT_ROLE_PERMISSIONS.generalTabs,
          ...(loadedPermissions.generalTabs || {}),
        },
        companySections: {
          ...DEFAULT_ROLE_PERMISSIONS.companySections,
          ...(loadedPermissions.companySections || {}),
        },
      });
    } catch (err) {
      console.error("Failed to load permissions", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to load permissions",
      );
      setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const savePermissions = async () => {
    if (!selectedCompany) {
      toast.error("Please select a company first");
      return;
    }

    try {
      setSavingPermissions(true);

      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/permissions",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: Number(selectedCompany.id),
            rolePermissions,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to save permissions");
      }

      const savedPermissions = data.rolePermissions || {};

      setRolePermissions({
        hrTabs: {
          ...DEFAULT_ROLE_PERMISSIONS.hrTabs,
          ...(savedPermissions.hrTabs || savedPermissions.adminTabs || {}),
        },
        generalTabs: {
          ...DEFAULT_ROLE_PERMISSIONS.generalTabs,
          ...(savedPermissions.generalTabs || {}),
        },
        companySections: {
          ...DEFAULT_ROLE_PERMISSIONS.companySections,
          ...(savedPermissions.companySections || {}),
        },
      });

      toast.success("Permissions saved successfully");
    } catch (err) {
      console.error("Failed to save permissions", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to save permissions",
      );
    } finally {
      setSavingPermissions(false);
    }
  };

  // Update Role Permission
  const updatePermission = (
    group: keyof RolePermissionsState,
    key: string,
    value: boolean,
  ) => {
    setRolePermissions((prev) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: value,
      },
    }));
  };

  const permissionRows = {
    hrTabs: [
      ["adminDashboard", "Admin Dashboard"],
      ["companySettings", "Company Settings"],
      ["scheduleGenerator", "Schedule Generator"],
      ["coverRequests", "Cover Requests"],
      ["reports", "Reports"],
      ["profile", "Profile"],
    ],
    generalTabs: [
      ["scheduleGenerator", "Schedule Generator"],
      ["coverRequests", "Cover Requests"],
      ["profile", "Profile"],
    ],
    companySections: [
      ["companyProfile", "Company Profile"],
      ["schedulingRules", "Scheduling Rules"],
      ["schedulerScoring", "Scheduler Scoring"],
      ["accountSchedulingPolicies", "Account Scheduling Policies"],
      ["schedulingBehavior", "Scheduling Behavior"],
      ["notificationPreferences", "Notification Preferences"],
    ],
  } as const;

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    setActiveTab("settings");
    fetchPermissions(company.id);
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
                  {selectedCompany
                    ? selectedCompany.employeeCount
                    : companies.reduce((sum, c) => sum + c.employeeCount, 0)}
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
                onClick={() => {
                  setSelectedCompany(null);
                  setRolePermissions(DEFAULT_ROLE_PERMISSIONS);
                  setActiveTab("companies");
                }}
                className="gap-2"
              >
                Back to Companies
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
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
                Company Settings
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
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[22%]">Company Name</TableHead>
                      <TableHead className="w-[16%]">Type</TableHead>
                      <TableHead className="w-[12%]">Employees</TableHead>
                      <TableHead className="w-[12%]">Status</TableHead>
                      <TableHead className="w-[18%]">Created Date</TableHead>
                      <TableHead className="w-[20%] text-right">
                        Actions
                      </TableHead>
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
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
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

        {/* Company Settings Tab */}
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
            <CompanySettings
              currentUser={{
                id: 0,
                name: "Super Admin",
                email: "",
                role: "super-admin",
                displayRole: "Super Admin",
                company_id: Number(selectedCompany.id),
                company_name: selectedCompany.name,
              }}
            />
          )}
        </TabsContent>

        {/* Role Permissions Tab */}
        <TabsContent value="permissions" className="space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-2xl">
                Role Permissions - {selectedCompany?.name}
              </h3>
              <p className="text-gray-600">
                Configure tab access and company settings section access for
                this company
              </p>

              {loadingPermissions && (
                <p className="text-sm text-gray-500 mt-1">
                  Loading permissions...
                </p>
              )}
            </div>

            <Button
              onClick={savePermissions}
              disabled={loadingPermissions || savingPermissions}
            >
              {savingPermissions ? "Saving..." : "Save Permissions"}
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Admin Employee Tab Permissions</CardTitle>
              <CardDescription>
                Control which tabs admin employees can access
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {permissionRows.hrTabs.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <Label>{label}</Label>
                  <Switch
                    checked={rolePermissions.hrTabs[key]}
                    disabled={loadingPermissions || savingPermissions}
                    onCheckedChange={(value) =>
                      updatePermission("hrTabs", key, value)
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Non-Admin Employee Tab Permissions</CardTitle>
              <CardDescription>
                Control which tabs non-admin employees can access
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {permissionRows.generalTabs.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <Label>{label}</Label>
                  <Switch
                    checked={rolePermissions.generalTabs[key]}
                    disabled={loadingPermissions || savingPermissions}
                    onCheckedChange={(value) =>
                      updatePermission("generalTabs", key, value)
                    }
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Company Settings Section Permissions</CardTitle>
              <CardDescription>
                Control which Company Settings sections admin employees can
                access
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {permissionRows.companySections.map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <Label>{label}</Label>
                  <Switch
                    checked={rolePermissions.companySections[key]}
                    disabled={loadingPermissions || savingPermissions}
                    onCheckedChange={(value) =>
                      updatePermission("companySections", key, value)
                    }
                  />
                </div>
              ))}
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
      {/* Confirm Remove Company Dialog */}
      <Dialog
        open={companyToRemove !== null}
        onOpenChange={(open) => {
          if (!open) {
            setCompanyToRemove(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Company?</DialogTitle>
            <DialogDescription>
              This will deactivate the company but keep its records.
            </DialogDescription>
          </DialogHeader>

          {companyToRemove && (
            <div className="rounded-lg border bg-gray-50 p-4 text-sm">
              <div className="grid grid-cols-[90px_1fr] gap-y-2">
                <span className="font-medium text-gray-600">Company</span>
                <span className="text-gray-900">{companyToRemove.name}</span>

                <span className="font-medium text-gray-600">Type</span>
                <span className="text-gray-900">
                  {companyToRemove.type || "—"}
                </span>

                <span className="font-medium text-gray-600">Employees</span>
                <span className="text-gray-900">
                  {companyToRemove.employeeCount}
                </span>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setCompanyToRemove(null)}>
              Cancel
            </Button>

            <Button variant="destructive" onClick={confirmRemoveCompany}>
              Remove Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
