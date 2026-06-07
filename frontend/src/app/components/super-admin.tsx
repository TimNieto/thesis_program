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
  const [companies, setCompanies] = useState<Company[]>([]);

  const fetchCompanies = async () => {
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/companies",
      );

      const data = await res.json();

      setCompanies(
        Array.isArray(data)
          ? data.map((company: any) => ({
              id: String(company.company_id),
              name: company.company_name,
              type: company.company_type || "Live Selling",
              employeeCount: Number(company.employee_count || 0),
              status: company.is_active ? "Active" : "Inactive",
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

      toast.success(`Company "${newCompanyName}" added successfully`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create company",
      );
    }
  };

  // Remove Company
  const handleRemoveCompany = (id: string, name: string) => {
    if (
      confirm(
        `Are you sure you want to remove "${name}"? This action cannot be undone.`,
      )
    ) {
      setCompanies(companies.filter((company) => company.id !== id));

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

  const getCompanyRolePermissions = () => {
    if (!selectedCompany) return [];
    return rolePermissions.filter((rp) => rp.companyId === selectedCompany.id);
  };

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company);
    setActiveTab("settings");
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
    </div>
  );
}
