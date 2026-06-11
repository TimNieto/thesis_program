// ---------------------------------------------------
// src/app/components/admin-dashboard.tsx

import { useState, useEffect } from "react";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  Users,
  UserPlus,
  UserMinus,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  AlertTriangle,
  CalendarOff,
  PartyPopper,
  Trash2,
  Upload,
  FileSpreadsheet,
  UserSquare2,
  Briefcase,
  CheckCircle2,
  Download,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: number;
  name: string;
  email: string;
  contactNumber?: string;
  role: string;
  status: "Active" | "Inactive";
  totalShifts: number;
  joinedDate: string | null;

  department_name?: string;
  departments?: string[];

  account_names?: string;
  accounts?: string[];
}

interface AccountDepartmentRow {
  department_id: number;
  department_name: string;
  department_is_active: boolean;
  account_id: number | null;
  account_name: string | null;
  account_is_active: boolean | null;
  status: "Active" | "Inactive";
}

interface AccountDepartmentDisplayRow extends AccountDepartmentRow {
  display_key: string;
  row_type: "department" | "account";
}

interface Request {
  id: string;
  type: "application" | "cover" | "leave";
  requester: string;
  livestream: string;
  day: string;
  shift: string;
  role: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
  leaveType?: string;
}

interface Assignment {
  id: string;
  livestream: string;
  day: string;
  shift: string;
  role: string;
  employee: string;
  approvedBy?: string;
  approvedAt?: string;
}

interface DayOffSlot {
  day: string;
  shift: string;
}

interface EmployeeDayOff {
  employeeId: number;
  unavailableSlots: DayOffSlot[];
}

interface AdminDashboardProps {
  currentUser: {
    id: number;
    name: string;
    email: string;
    role: string;
    displayRole: string;
    company_id: number | null;
    company_name: string | null;
  };
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);

  interface Holiday {
    id: string;
    name: string;
    date: string;
  }

  const [holidays, setHolidays] = useState<Holiday[]>([
    { id: "1", name: "New Year's Day", date: "2025-01-01" },
    { id: "2", name: "Christmas Day", date: "2025-12-25" },
  ]);

  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");

  type ImportCategory =
    | "departments"
    | "roles"
    | "employees"
    | "employeeAssignments"
    | "shifts"
    | "staffing";

  const IMPORT_ENDPOINTS: Record<ImportCategory, string | null> = {
    departments: "/account-department-import",
    roles: "/staffing-roles-import",
    employees: "/employees-import",
    employeeAssignments: null,
    shifts: null,
    staffing: null,
  };

  interface ImportRecord {
    id: string;
    category: ImportCategory;
    fileName: string;
    rowCount: number;
    importedAt: string;
    status: "success" | "error";
  }

  const [importRecords, setImportRecords] = useState<ImportRecord[]>([]);

  const [isTemplatePreviewOpen, setIsTemplatePreviewOpen] = useState(false);
  const [isRolesTemplatePreviewOpen, setIsRolesTemplatePreviewOpen] =
    useState(false);
  const [isEmployeesTemplatePreviewOpen, setIsEmployeesTemplatePreviewOpen] =
    useState(false);

  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [newRoleDepartmentName, setNewRoleDepartmentName] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState("no");

  const [isAccountDepartmentDialogOpen, setIsAccountDepartmentDialogOpen] =
    useState(false);

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentAccountName, setNewDepartmentAccountName] = useState("");

  const [selectedExistingDepartment, setSelectedExistingDepartment] =
    useState("");
  const [newAccountName, setNewAccountName] = useState("");

  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);

  const [staffingRoles, setStaffingRoles] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [requests, setRequests] = useState<Request[]>([]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Employee Management States
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeContactNumber, setNewEmployeeContactNumber] = useState("");
  const [newEmployeeNickname, setNewEmployeeNickname] = useState("");

  const [accounts, setAccounts] = useState<any[]>([]);
  const [accountDepartmentRows, setAccountDepartmentRows] = useState<
    AccountDepartmentRow[]
  >([]);

  // Override Dialog States
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] =
    useState<Assignment | null>(null);
  const [overrideEmployee, setOverrideEmployee] = useState("");

  // Day Off Management States
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);

  const [selectedEmployeeForDayOff, setSelectedEmployeeForDayOff] = useState<
    number | null
  >(null);
  const [employeeAvailability, setEmployeeAvailability] = useState<any>({});

  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] =
    useState(false);
  const [selectedEmployeeForAvailability, setSelectedEmployeeForAvailability] =
    useState<Employee | null>(null);

  const fetchEmployees = async () => {
    if (!currentUser.company_id) {
      setEmployees([]);
      return;
    }

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/employees?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.log("Failed to load employees");
      setEmployees([]);
    }
  };

  const fetchShiftTemplates = async () => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/shift-templates?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      const orderedShifts = (Array.isArray(data) ? data : []).sort((a, b) => {
        const aTime = String(a.start_time || "00:00:00");
        const bTime = String(b.start_time || "00:00:00");

        return aTime.localeCompare(bTime);
      });

      setShiftTemplates(orderedShifts);
    } catch (err) {
      console.error("Failed to load shift templates", err);
    }
  };

  const fetchStaffingRequirements = async () => {
    try {
      if (!currentUser.company_id) {
        setStaffingRoles([]);
        return;
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/staffing-requirements?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      setStaffingRoles(data.roles || []);
    } catch (err) {
      console.error("Failed to load staffing roles", err);
      setStaffingRoles([]);
    }
  };

  const fetchAccounts = async () => {
    if (!currentUser.company_id) {
      setAccounts([]);
      return;
    }

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/accounts?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      setAccounts(data);
    } catch (err) {
      console.error("Failed to load accounts", err);
    }
  };

  const fetchAccountDepartmentData = async () => {
    if (!currentUser.company_id) {
      setAccountDepartmentRows([]);
      return;
    }

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/account-department-data?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      setAccountDepartmentRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load account/department data", err);
      setAccountDepartmentRows([]);
    }
  };

  useEffect(() => {
    if (!currentUser.company_id) return;
    if (shiftTemplates.length === 0) return;

    fetchAvailability();
  }, [currentUser.company_id, shiftTemplates]);

  useEffect(() => {
    const loadAdminData = async () => {
      if (currentUser.role.toLowerCase() !== "admin") {
        return;
      }

      setIsLoading(true);

      try {
        await fetchEmployees();
        await fetchShiftTemplates();
        await fetchStaffingRequirements();
        await fetchAccounts();
        await fetchAccountDepartmentData();
      } finally {
        setIsLoading(false);
      }
    };

    loadAdminData();
  }, [currentUser.role, currentUser.company_id]);

  const handleAddHoliday = () => {
    if (!newHolidayName.trim()) {
      toast.error("Please enter a holiday name");
      return;
    }

    if (!newHolidayDate) {
      toast.error("Please select a date");
      return;
    }

    setHolidays((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: newHolidayName.trim(),
        date: newHolidayDate,
      },
    ]);

    setNewHolidayName("");
    setNewHolidayDate("");

    toast.success("Holiday added");
  };

  const handleRemoveHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    toast.success("Holiday removed");
  };

  const refreshAfterImport = async (category: ImportCategory) => {
    if (category === "departments") {
      await fetchAccountDepartmentData();
      await fetchAccounts();
    }

    if (category === "roles") {
      await fetchStaffingRequirements();
    }

    if (category === "employees") {
      await fetchEmployees();
    }

    if (category === "employeeAssignments") {
      await fetchEmployees();
    }

    if (category === "shifts") {
      await fetchShiftTemplates();
    }

    if (category === "staffing") {
      await fetchStaffingRequirements();
    }
  };

  const parseCsvPreview = (text: string) => {
    return text
      .trim()
      .split("\n")
      .map((row) =>
        row.split(",").map((cell) => cell.replace(/^"|"$/g, "").trim()),
      );
  };

  const getImportErrorMessage = (data: any) => {
    if (typeof data?.detail === "string") {
      return data.detail;
    }

    if (data?.detail?.message && Array.isArray(data.detail.errors)) {
      return `${data.detail.message}\n${data.detail.errors.join("\n")}`;
    }

    if (data?.detail?.message) {
      return data.detail.message;
    }

    return "Import failed";
  };

  const handleFileImport = async (category: ImportCategory, file: File) => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      const endpoint = IMPORT_ENDPOINTS[category];

      if (!endpoint) {
        throw new Error("This import type is not connected to the backend yet");
      }

      const text = await file.text();
      const rows = parseCsvPreview(text);

      if (rows.length < 2) {
        throw new Error("File has no data rows");
      }

      const formData = new FormData();

      formData.append("company_id", String(currentUser.company_id));
      formData.append("file", file);

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app${endpoint}`,
        {
          method: "POST",
          body: formData,
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(getImportErrorMessage(data));
      }

      setImportRecords((prev) => [
        {
          id: Date.now().toString(),
          category,
          fileName: file.name,
          rowCount: rows.length - 1,
          importedAt: new Date().toLocaleString(),
          status: "success",
        },
        ...prev,
      ]);

      await refreshAfterImport(category);

      toast.success(data?.message || `Imported ${rows.length - 1} rows`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";

      setImportRecords((prev) => [
        {
          id: Date.now().toString(),
          category,
          fileName: file.name,
          rowCount: 0,
          importedAt: new Date().toLocaleString(),
          status: "error",
        },
        ...prev,
      ]);

      toast.error(msg);
    }
  };

  const downloadImportTemplate = (
    category: ImportCategory,
    templateHeaders: string,
  ) => {
    const blob = new Blob([templateHeaders + "\n"], {
      type: "text/csv",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `${category}_template.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const triggerImportInput = (category: ImportCategory) => {
    document.getElementById(`${category}-csv-input`)?.click();
  };

  const resetAccountDepartmentForm = () => {
    setNewDepartmentName("");
    setNewDepartmentAccountName("");
    setSelectedExistingDepartment("");
    setNewAccountName("");
  };

  const handleAddDepartmentSubmit = async () => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      if (!newDepartmentName.trim()) {
        throw new Error("Department name is required");
      }

      const hasAccountName = newDepartmentAccountName.trim().length > 0;

      const endpoint = hasAccountName ? "/accounts" : "/departments";

      const body = hasAccountName
        ? {
            company_id: currentUser.company_id,
            department_name: newDepartmentName,
            account_name: newDepartmentAccountName,
          }
        : {
            company_id: currentUser.company_id,
            department_name: newDepartmentName,
          };

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to save department");
      }

      await fetchAccountDepartmentData();
      await fetchAccounts();

      resetAccountDepartmentForm();
      setIsAccountDepartmentDialogOpen(false);

      toast.success(data?.message || "Department saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleAddAccountSubmit = async () => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      if (!selectedExistingDepartment) {
        throw new Error("Please select a department");
      }

      if (!newAccountName.trim()) {
        throw new Error("Account name is required");
      }

      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/accounts",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentUser.company_id,
            department_name: selectedExistingDepartment,
            account_name: newAccountName,
          }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to save account");
      }

      await fetchAccountDepartmentData();
      await fetchAccounts();

      resetAccountDepartmentForm();
      setIsAccountDepartmentDialogOpen(false);

      toast.success(data?.message || "Account saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleDeactivateAccountDepartment = async (
    row: AccountDepartmentRow,
  ) => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      const isAccount = row.account_id !== null;

      const confirmMessage = isAccount
        ? `Deactivate account "${row.account_name}"?`
        : `Deactivate department "${row.department_name}"?`;

      if (!confirm(confirmMessage)) {
        return;
      }

      const url = isAccount
        ? `https://backend-production-6e75.up.railway.app/accounts/${row.account_id}?company_id=${currentUser.company_id}`
        : `https://backend-production-6e75.up.railway.app/departments/${row.department_id}?company_id=${currentUser.company_id}`;

      const res = await fetch(url, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to deactivate");
      }

      await fetchAccountDepartmentData();
      await fetchAccounts();
      await fetchStaffingRequirements();
      await fetchEmployees();

      toast.success(data?.message || "Deactivated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate");
    }
  };

  const handleAddRoleSubmit = async () => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      if (!newRoleDepartmentName) {
        throw new Error("Please select a department");
      }

      if (!newRoleName.trim()) {
        throw new Error("Role name is required");
      }

      const normalizedRoleName = newRoleName.trim();

      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/staffing-roles",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentUser.company_id,
            department_name: newRoleDepartmentName,
            role_name: normalizedRoleName,
            is_admin: newRoleIsAdmin,
          }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to add role");
      }

      await fetchStaffingRequirements();

      setNewRoleDepartmentName("");
      setNewRoleName("");
      setNewRoleIsAdmin("no");
      setIsAddRoleOpen(false);

      toast.success(data?.message || "Role saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add role");
    }
  };

  const handleDeactivateRole = async (role: any) => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      const roleId = role.staffing_role_id ?? role.role_id;

      if (!roleId) {
        throw new Error("Invalid role");
      }

      if (!confirm(`Deactivate role "${role.role_name}"?`)) {
        return;
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/staffing-roles/${roleId}?company_id=${currentUser.company_id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to deactivate role");
      }

      await fetchStaffingRequirements();

      toast.success(data?.message || "Role deactivated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to deactivate role",
      );
    }
  };

  const getEmployeeAccounts = (employee: Employee) => {
    if (employee.account_names) {
      return employee.account_names;
    }

    if (Array.isArray(employee.accounts) && employee.accounts.length > 0) {
      return employee.accounts.join(", ");
    }

    return "None";
  };

  const tableClass = "table-fixed w-full";

  const actionCellClass = "w-[140px] text-right";

  const dangerSmallButtonClass =
    "bg-red-600 text-white hover:bg-red-700 border-red-600";

  const renderStatusBadge = (status: string = "Active") => (
    <Badge variant={status === "Active" ? "default" : "secondary"}>
      {status}
    </Badge>
  );

  const groupedAccountDepartmentRows: AccountDepartmentDisplayRow[] =
    Array.from(
      accountDepartmentRows
        .reduce(
          (map, row) => {
            const existing = map.get(row.department_id) ?? {
              departmentRow: {
                ...row,
                account_id: null,
                account_name: null,
                account_is_active: null,
                display_key: `department-${row.department_id}`,
                row_type: "department" as const,
              },
              accountRows: [] as AccountDepartmentDisplayRow[],
            };

            if (row.account_id !== null) {
              existing.accountRows.push({
                ...row,
                display_key: `account-${row.account_id}`,
                row_type: "account" as const,
              });
            }

            map.set(row.department_id, existing);

            return map;
          },
          new Map<
            number,
            {
              departmentRow: AccountDepartmentDisplayRow;
              accountRows: AccountDepartmentDisplayRow[];
            }
          >(),
        )
        .values(),
    ).flatMap((group) => [group.departmentRow, ...group.accountRows]);

  const activeDepartmentOptions = Array.from(
    accountDepartmentRows
      .reduce((map, row) => {
        if (row.department_is_active) {
          map.set(row.department_id, row.department_name);
        }

        return map;
      }, new Map<number, string>())
      .values(),
  ).sort((a, b) => a.localeCompare(b));

  const groupedRoleRows = Array.from(
    staffingRoles
      .reduce(
        (map, role) => {
          const departmentName = role.department_name || "None";
          const key = departmentName.toLowerCase();

          const existing = map.get(key) ?? {
            departmentRow: {
              display_key: `role-department-${key}`,
              row_type: "department" as const,
              department_name: departmentName,
            },
            roleRows: [] as any[],
          };

          existing.roleRows.push({
            ...role,
            display_key: `role-${role.staffing_role_id ?? role.role_id}`,
            row_type: "role" as const,
          });

          map.set(key, existing);

          return map;
        },
        new Map<
          string,
          {
            departmentRow: {
              display_key: string;
              row_type: "department";
              department_name: string;
            };
            roleRows: any[];
          }
        >(),
      )
      .values(),
  ).flatMap((group) => [group.departmentRow, ...group.roleRows]);

  const assignedEmployees = employees.filter((employee) => {
    const hasRole =
      employee.role && employee.role.trim() !== "" && employee.role !== "None";

    return hasRole;
  });

  // Add Employee
  const handleAddEmployee = async () => {
    if (!newEmployeeName.trim()) {
      toast.error("Employee name is required");
      return;
    }

    if (!newEmployeeNickname.trim()) {
      toast.error("Nickname is required");
      return;
    }

    if (!newEmployeeEmail.includes("@")) {
      toast.error("Valid email required");
      return;
    }

    if (!newEmployeeContactNumber.trim()) {
      toast.error("Contact number is required");
      return;
    }

    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/employees",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newEmployeeName,
            nickname: newEmployeeNickname,
            email: newEmployeeEmail,
            contactNumber: newEmployeeContactNumber,
            company_id: currentUser.company_id,
            created_by: currentUser.id,
          }),
        },
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to add employee");
      }

      const result = await res.json();

      fetchEmployees();
      setIsAddEmployeeOpen(false);

      setNewEmployeeName("");
      setNewEmployeeNickname("");
      setNewEmployeeEmail("");
      setNewEmployeeContactNumber("");

      toast.success(result.message || "Employee saved");
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to add employee",
      );
    }
  };

  // Remove Employee
  const confirmRemoveEmployee = async () => {
    if (!employeeToDelete) return;

    await fetch(
      `https://backend-production-6e75.up.railway.app/employees/${employeeToDelete}`,
      {
        method: "DELETE",
      },
    );

    fetchEmployees();
    setIsConfirmDeleteOpen(false);
    setEmployeeToDelete(null);

    toast.success("Employee deactivated");
  };

  // Toggle Employee Status
  const toggleEmployeeStatus = (id: number) => {
    setEmployees(
      employees.map((emp) =>
        emp.id === id
          ? { ...emp, status: emp.status === "Active" ? "Inactive" : "Active" }
          : emp,
      ),
    );
    toast.success("Employee status updated");
  };

  // Update Employee Role
  const updateEmployeeRole = async (
    id: number,
    role: "Host" | "Operator" | "Both" | "Team Leader",
  ) => {
    await fetch(
      `https://backend-production-6e75.up.railway.app/employees/${id}/role`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      },
    );

    fetchEmployees();
  };

  // Approve/Decline Request
  const updateRequestStatus = (id: string, status: "approved" | "denied") => {
    setRequests(
      requests.map((req) => (req.id === id ? { ...req, status } : req)),
    );
    toast.success(`Request ${status}`);
  };

  // Override Assignment
  const openOverrideDialog = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setOverrideEmployee(assignment.employee);
    setIsOverrideDialogOpen(true);
  };

  const handleOverrideAssignment = () => {
    if (!selectedAssignment || !overrideEmployee.trim()) {
      toast.error("Please enter an employee name");
      return;
    }

    setAssignments(
      assignments.map((a) =>
        a.id === selectedAssignment.id
          ? {
              ...a,
              employee: overrideEmployee,
              approvedBy: currentUser.name,
              approvedAt: new Date().toISOString().split("T")[0],
            }
          : a,
      ),
    );

    setIsOverrideDialogOpen(false);
    setSelectedAssignment(null);
    setOverrideEmployee("");
    toast.success("Assignment overridden successfully");
  };

  // Remove Assignment
  const handleRemoveAssignment = (id: string) => {
    if (confirm("Are you sure you want to remove this assignment?")) {
      setAssignments(assignments.filter((a) => a.id !== id));
      toast.success("Assignment removed");
    }
  };

  // Day Off Management Functions
  const isSlotUnavailable = (
    employeeId: number,
    day: string,
    shift: string,
  ): boolean => {
    const emp = employeeAvailability[employeeId];

    // ❗ No employee record → UNAVAILABLE
    if (!emp) return true;

    const dayData = emp[day.toLowerCase()];

    // ❗ No day → UNAVAILABLE
    if (!dayData) return true;

    const shiftData = dayData[String(shift).toLowerCase()];

    // ❗ No shift → UNAVAILABLE
    if (shiftData === undefined) return true;

    // ❗ false = unavailable → return true (grey)
    return !shiftData;
  };

  const toggleSlotAvailability = async (
    employeeId: number,
    day: string,
    shift: string,
  ) => {
    // 🔥 STEP 1: determine current state
    const isCurrentlyUnavailable = isSlotUnavailable(employeeId, day, shift);

    // 🔥 STEP 2: send to backend FIRST
    try {
      await fetch(
        "https://backend-production-6e75.up.railway.app/availability",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employee_id: employeeId,
            company_id: currentUser.company_id,
            day_of_week: day.toLowerCase(),
            preferred_shift: shift.toLowerCase(),
            shift_template_id:
              shiftTemplates.find((s) => s.shift_name === shift)
                ?.shift_template_id || null,
            is_available: isCurrentlyUnavailable,
          }),
        },
      );

      await fetchAvailability();
    } catch (err) {
      console.error("Failed to update availability", err);
      return; // ❗ stop if backend fails
    }
  };

  const fetchAvailability = async () => {
    try {
      const companyId = currentUser.company_id;

      if (!companyId) return;

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/availability?company_id=${companyId}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load availability");
      }

      const transformed: any = {};

      data.forEach((row: any) => {
        if (!row.day_of_week) return;

        const empId = Number(row.employee_id);
        const day = String(row.day_of_week).toLowerCase();

        const matchedShift =
          shiftTemplates.find(
            (shift) =>
              Number(shift.shift_template_id) === Number(row.shift_template_id),
          ) ||
          shiftTemplates.find(
            (shift) =>
              String(shift.shift_name).toLowerCase() ===
              String(row.preferred_shift || "").toLowerCase(),
          );

        if (!matchedShift) return;

        const shiftKey = String(matchedShift.shift_name).toLowerCase();

        if (!transformed[empId]) {
          transformed[empId] = {};
        }

        if (!transformed[empId][day]) {
          transformed[empId][day] = {};
        }

        transformed[empId][day][shiftKey] = row.is_available;
      });

      console.log("STRICT AVAILABILITY MAP:", transformed);

      setEmployeeAvailability(transformed);
    } catch (err) {
      console.error("Failed to load availability", err);
    }
  };

  const openAvailabilityDialog = (
    employee: Employee,
    openDialog: boolean = true,
  ) => {
    setSelectedEmployeeForAvailability(employee);

    if (openDialog) {
      setIsAvailabilityDialogOpen(true);
    }

    fetchAvailability(); // pass id directly if possible
  };

  // Statistics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "Active").length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const totalAssignments = assignments.length;
  const totalSlots = DAYS.length * shiftTemplates.length * staffingRoles.length;

  const getRequestTypeColor = (type: string) => {
    const colors = {
      application: "bg-blue-100 text-blue-700",
      cover: "bg-orange-100 text-orange-700",
      leave: "bg-purple-100 text-purple-700",
    };
    return colors[type as keyof typeof colors] || "bg-gray-100";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="size-4 text-green-600" />;
      case "denied":
        return <XCircle className="size-4 text-red-600" />;
      default:
        return <Clock className="size-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: "default",
      denied: "destructive",
      pending: "secondary",
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] as any}>
        {status}
      </Badge>
    );
  };

  const getShiftInfo = (code: string) => {
    return shiftTemplates.find((s) => s.shift_name === code);
  };

  if (currentUser.role.toLowerCase() !== "admin") {
    return (
      <div className="p-6">
        <p className="text-red-500 text-lg font-semibold">
          Access denied. Admins only.
        </p>
      </div>
    );
  }

  // 🟡 THEN: handle loading
  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  // (optional logs after checks)
  console.log("currentUser:", currentUser);
  console.log("employees:", employees);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl">Admin Dashboard</h2>
        <p className="text-gray-600">
          Manage employees, schedules, and approvals
        </p>
      </div>

      {/* Statistics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Employees</p>
                <p className="text-2xl font-bold">{totalEmployees}</p>
              </div>
              <Users className="size-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Employees</p>
                <p className="text-2xl font-bold">{activeEmployees}</p>
              </div>
              <CheckCircle className="size-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Requests</p>
                <p className="text-2xl font-bold">{pendingRequests}</p>
              </div>
              <AlertTriangle className="size-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Filled Slots</p>
                <p className="text-2xl font-bold">
                  {totalAssignments} / {totalSlots}
                </p>
              </div>
              <BarChart3 className="size-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="grid w-full max-w-3xl grid-cols-2">
          <TabsTrigger value="employees" className="gap-2">
            <Users className="size-4" />
            Employees
          </TabsTrigger>

          <TabsTrigger value="imports" className="gap-2">
            <Upload className="size-4" />
            Imports
          </TabsTrigger>

          {/*
          <TabsTrigger value="assignments" className="gap-2">
            <Calendar className="size-4" />
            Assignments
          </TabsTrigger>
          */}
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Employee Management</CardTitle>
                  <CardDescription>
                    Add, remove, or modify employee details
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsAddEmployeeOpen(true)}
                >
                  <Plus className="size-4" />
                  Add Employee
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Joined Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 py-6"
                        >
                          No employees found. Click "Add Employee" to get
                          started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      [...employees]
                        .sort((a, b) => {
                          const rolePriority: Record<string, number> = {
                            "Team Leader": 1,
                            Host: 2,
                            Operator: 3,
                            Both: 4,
                          };

                          return (
                            (rolePriority[a.role] || 99) -
                            (rolePriority[b.role] || 99)
                          );
                        })
                        .map((employee) => (
                          <TableRow key={employee.id}>
                            <TableCell className="font-medium">
                              {employee.name}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={employee.role}
                                onValueChange={(value) =>
                                  updateEmployeeRole(
                                    employee.id,
                                    value as
                                      | "Host"
                                      | "Operator"
                                      | "Both"
                                      | "Team Leader",
                                  )
                                }
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Team Leader">
                                    Team Leader
                                  </SelectItem>
                                  <SelectItem value="Host">Host</SelectItem>
                                  <SelectItem value="Operator">
                                    Operator
                                  </SelectItem>
                                  <SelectItem value="Both">Both</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  employee.status === "Active"
                                    ? "default"
                                    : "secondary"
                                }
                                className="cursor-pointer"
                                onClick={() =>
                                  toggleEmployeeStatus(employee.id)
                                }
                              >
                                {employee.status}
                              </Badge>
                            </TableCell>

                            <TableCell>
                              {new Date(
                                employee.joinedDate,
                              ).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    openAvailabilityDialog(employee)
                                  }
                                  className="gap-2"
                                >
                                  <CalendarOff className="size-4" />
                                  Availability
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setEmployeeToDelete(employee.id);
                                    setIsConfirmDeleteOpen(true);
                                  }}
                                  className="gap-2"
                                >
                                  <UserMinus className="size-4" />
                                  Deactivate
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Day Offs Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarOff className="size-5 text-blue-600" />
                    Day Offs
                  </CardTitle>
                  <CardDescription>
                    Manage weekly unavailable shifts for employees
                  </CardDescription>
                </div>
                <div className="w-64">
                  <Select
                    value={selectedEmployeeForDayOff?.toString() || ""}
                    onValueChange={(value) => {
                      const employeeId = Number(value);

                      setSelectedEmployeeForDayOff(employeeId);

                      const employee = employees.find(
                        (e) => e.id === employeeId,
                      );

                      if (employee) {
                        openAvailabilityDialog(employee, false); // 👈 KEY LINE
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem
                          key={employee.id}
                          value={employee.id.toString()}
                        >
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {selectedEmployeeForDayOff !== null ? (
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Click on any shift to toggle availability. Greyed out shifts
                    are unavailable.
                  </p>
                  <div className="overflow-x-auto">
                    <div className="min-w-max">
                      <div className="grid grid-cols-8 gap-2">
                        <div className="font-medium p-3"></div>
                        {DAYS.map((day) => (
                          <div
                            key={day}
                            className="font-medium p-3 text-center bg-gray-100 rounded"
                          >
                            {day}
                          </div>
                        ))}
                      </div>

                      {shiftTemplates.map((shift) => (
                        <div
                          key={shift.shift_name}
                          className="grid grid-cols-8 gap-2 mt-2"
                        >
                          <div className="p-3 font-medium bg-gray-100 rounded flex flex-col justify-center">
                            <div>
                              {shift.shift_name} - {shift.name}
                            </div>
                            <div className="text-xs text-gray-600">
                              {shift.time}
                            </div>
                          </div>
                          {DAYS.map((day) => {
                            const isUnavailable = isSlotUnavailable(
                              selectedEmployeeForDayOff,
                              day,
                              shift.shift_name,
                            );
                            return (
                              <div
                                key={`${day}-${shift.shift_name}`}
                                onClick={() =>
                                  toggleSlotAvailability(
                                    selectedEmployeeForDayOff,
                                    day,
                                    shift.shift_name,
                                  )
                                }
                                className={`
                                  p-3 rounded border-2 cursor-pointer transition-all min-h-[60px] flex items-center justify-center
                                  ${
                                    isUnavailable
                                      ? "bg-gray-300 border-gray-400 text-gray-500"
                                      : "bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                                  }
                                `}
                              >
                                <span className="text-sm font-medium">
                                  {isUnavailable ? "Unavailable" : "Available"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CalendarOff className="size-12 mx-auto mb-3 text-gray-400" />
                  <p>
                    Select an employee to view and manage their day off schedule
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Holidays Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PartyPopper className="size-5 text-rose-500" />
                Holidays
              </CardTitle>
              <CardDescription>
                Set company holidays so they are reflected in schedules and
                requests
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-medium text-gray-600">
                    Holiday Name
                  </Label>
                  <Input
                    placeholder="e.g. Independence Day"
                    value={newHolidayName}
                    onChange={(e) => setNewHolidayName(e.target.value)}
                    className="w-56"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddHoliday();
                    }}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-medium text-gray-600">
                    Date
                  </Label>
                  <Input
                    type="date"
                    value={newHolidayDate}
                    onChange={(e) => setNewHolidayDate(e.target.value)}
                    className="w-44"
                  />
                </div>

                <Button onClick={handleAddHoliday} className="gap-2">
                  <CheckCircle2 className="size-4" />
                  Add Holiday
                </Button>
              </div>

              {holidays.length > 0 ? (
                <div className="overflow-x-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Holiday Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {[...holidays]
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="font-medium">
                              {h.name}
                            </TableCell>

                            <TableCell>
                              {new Date(
                                h.date + "T00:00:00",
                              ).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </TableCell>

                            <TableCell className="text-gray-500">
                              {new Date(
                                h.date + "T00:00:00",
                              ).toLocaleDateString("en-US", {
                                weekday: "long",
                              })}
                            </TableCell>

                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 h-7 px-2"
                                onClick={() => handleRemoveHoliday(h.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <PartyPopper className="size-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No holidays added yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Imports Tab */}
        <TabsContent value="imports" className="space-y-6">
          <div>
            <h3 className="text-2xl">Imports</h3>
            <p className="text-gray-600">
              Import company setup data in dependency order. Start from Account
              / Department Data, then continue downward.
            </p>
          </div>

          {/* Account / Department Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Briefcase className="size-5 text-purple-600" />
                  <div>
                    <CardTitle>Account / Department Data</CardTitle>
                    <CardDescription>
                      Creates departments first, then accounts under those
                      departments.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsTemplatePreviewOpen(true)}
                  >
                    <Download className="size-4" />
                    View Template
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => triggerImportInput("departments")}
                  >
                    <Upload className="size-4" />
                    Import CSV
                  </Button>

                  <Input
                    id="departments-csv-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        handleFileImport("departments", file);
                      }

                      e.currentTarget.value = "";
                    }}
                  />

                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsAccountDepartmentDialogOpen(true)}
                  >
                    <Plus className="size-4" />
                    Add Account/Department
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table className={tableClass}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[34%]">Department</TableHead>
                      <TableHead className="w-[34%]">Account Name</TableHead>
                      <TableHead className="w-[14%]">Status</TableHead>
                      <TableHead className={actionCellClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {groupedAccountDepartmentRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-gray-500 py-6"
                        >
                          No account or department data found. Use Add or Import
                          CSV to add records.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupedAccountDepartmentRows.map((row) => (
                        <TableRow key={row.display_key} className="h-12">
                          <TableCell className="font-medium truncate">
                            {row.row_type === "department"
                              ? row.department_name
                              : ""}
                          </TableCell>

                          <TableCell
                            className={
                              row.row_type === "account"
                                ? "truncate pl-6"
                                : "truncate text-gray-400"
                            }
                          >
                            {row.row_type === "account" ? row.account_name : ""}
                          </TableCell>

                          <TableCell>
                            {renderStatusBadge(
                              row.row_type === "account"
                                ? row.account_is_active
                                  ? "Active"
                                  : "Inactive"
                                : row.department_is_active
                                  ? "Active"
                                  : "Inactive",
                            )}
                          </TableCell>

                          <TableCell className={actionCellClass}>
                            <Button
                              size="sm"
                              className={dangerSmallButtonClass}
                              onClick={() =>
                                handleDeactivateAccountDepartment(row)
                              }
                            >
                              Deactivate
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Roles */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <UserSquare2 className="size-5 text-orange-600" />
                  <div>
                    <CardTitle>Roles</CardTitle>
                    <CardDescription>
                      Creates role definitions used by employee assignments and
                      staffing requirements.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsRolesTemplatePreviewOpen(true)}
                  >
                    <Download className="size-4" />
                    View Template
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => triggerImportInput("roles")}
                  >
                    <Upload className="size-4" />
                    Import CSV
                  </Button>

                  <Input
                    id="roles-csv-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        handleFileImport("roles", file);
                      }

                      e.currentTarget.value = "";
                    }}
                  />

                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsAddRoleOpen(true)}
                  >
                    <Plus className="size-4" />
                    Add Role
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table className={tableClass}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[22%]">Department</TableHead>
                      <TableHead className="w-[22%]">Role Name</TableHead>
                      <TableHead className="w-[20%]">Role Key</TableHead>
                      <TableHead className="w-[12%]">Admin</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className={actionCellClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {groupedRoleRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500 py-6"
                        >
                          No roles found. Use Add Role or Import CSV to add
                          records.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupedRoleRows.map((row: any) => (
                        <TableRow key={row.display_key} className="h-12">
                          <TableCell className="font-medium truncate">
                            {row.row_type === "department"
                              ? row.department_name
                              : ""}
                          </TableCell>

                          <TableCell
                            className={
                              row.row_type === "role"
                                ? "font-medium truncate pl-6"
                                : "truncate text-gray-400"
                            }
                          >
                            {row.row_type === "role" ? row.role_name : ""}
                          </TableCell>

                          <TableCell className="truncate">
                            {row.row_type === "role" ? row.role_key : ""}
                          </TableCell>

                          <TableCell>
                            {row.row_type === "role" ? (
                              <Badge
                                variant={row.is_admin ? "default" : "secondary"}
                              >
                                {row.is_admin ? "Yes" : "No"}
                              </Badge>
                            ) : (
                              ""
                            )}
                          </TableCell>

                          <TableCell>
                            {row.row_type === "role"
                              ? renderStatusBadge("Active")
                              : ""}
                          </TableCell>

                          <TableCell className={actionCellClass}>
                            {row.row_type === "role" && (
                              <Button
                                size="sm"
                                className={dangerSmallButtonClass}
                                onClick={() => handleDeactivateRole(row)}
                              >
                                Deactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Employee Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Users className="size-5 text-blue-600" />
                  <div>
                    <CardTitle>Employee Data</CardTitle>
                    <CardDescription>
                      Creates basic employee profiles only.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsEmployeesTemplatePreviewOpen(true)}
                  >
                    <Download className="size-4" />
                    View Template
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => triggerImportInput("employees")}
                  >
                    <Upload className="size-4" />
                    Import CSV
                  </Button>

                  <Input
                    id="employees-csv-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        handleFileImport("employees", file);
                      }

                      e.currentTarget.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsAddEmployeeOpen(true)}
                  >
                    <Plus className="size-4" />
                    Add Employee
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table className={tableClass}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[22%]">Name</TableHead>
                      <TableHead className="w-[26%]">Email</TableHead>
                      <TableHead className="w-[18%]">Contact Number</TableHead>
                      <TableHead className="w-[14%]">Joined Date</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className={actionCellClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500 py-6"
                        >
                          No employees found. Use Add Employee or Import CSV to
                          add records.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employees.map((employee) => (
                        <TableRow
                          key={`employee-data-${employee.id}`}
                          className="h-12"
                        >
                          <TableCell className="font-medium truncate">
                            {employee.name}
                          </TableCell>

                          <TableCell className="truncate">
                            {employee.email}
                          </TableCell>

                          <TableCell className="truncate">
                            {employee.contactNumber || "—"}
                          </TableCell>

                          <TableCell>
                            {employee.joinedDate
                              ? new Date(
                                  employee.joinedDate,
                                ).toLocaleDateString()
                              : "—"}
                          </TableCell>

                          <TableCell>
                            {renderStatusBadge(employee.status)}
                          </TableCell>

                          <TableCell className={actionCellClass}>
                            <Button
                              size="sm"
                              className={dangerSmallButtonClass}
                              onClick={() => {
                                setEmployeeToDelete(employee.id);
                                setIsConfirmDeleteOpen(true);
                              }}
                            >
                              Deactivate
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Employee Assignments */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-green-600" />
                  <div>
                    <CardTitle>Employee Assignments</CardTitle>
                    <CardDescription>
                      Connects existing employees to departments, roles, and
                      accounts.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      downloadImportTemplate(
                        "employeeAssignments",
                        "employee_email,department_name,role_name,account_name,status",
                      )
                    }
                  >
                    <Download className="size-4" />
                    Template
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => triggerImportInput("employeeAssignments")}
                  >
                    <Upload className="size-4" />
                    Import CSV
                  </Button>

                  <Input
                    id="employeeAssignments-csv-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        handleFileImport("employeeAssignments", file);
                      }

                      e.currentTarget.value = "";
                    }}
                  />

                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      toast.info(
                        "Manual employee assignment add is frontend-only for now",
                      )
                    }
                  >
                    <Plus className="size-4" />
                    Add Assignment
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table className={tableClass}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[22%]">Employee</TableHead>
                      <TableHead className="w-[22%]">Department</TableHead>
                      <TableHead className="w-[18%]">Role</TableHead>
                      <TableHead className="w-[22%]">Account</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className={actionCellClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {assignedEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500 py-6"
                        >
                          No employee assignments found. Import employees,
                          departments, accounts, and roles first.
                        </TableCell>
                      </TableRow>
                    ) : (
                      assignedEmployees.map((employee) => (
                        <TableRow
                          key={`assignment-${employee.id}`}
                          className="h-12"
                        >
                          <TableCell className="font-medium truncate">
                            {employee.name}
                          </TableCell>

                          <TableCell className="truncate">
                            {employee.department_name || "None"}
                          </TableCell>

                          <TableCell className="truncate">
                            {employee.role || "None"}
                          </TableCell>

                          <TableCell className="truncate">
                            {getEmployeeAccounts(employee)}
                          </TableCell>

                          <TableCell>
                            {renderStatusBadge(employee.status)}
                          </TableCell>

                          <TableCell className={actionCellClass}>
                            <Button
                              size="sm"
                              className={dangerSmallButtonClass}
                              onClick={() =>
                                toast.info(
                                  "Remove employee assignment is frontend-only for now",
                                )
                              }
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Shift Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="size-5 text-indigo-600" />
                  <div>
                    <CardTitle>Shift Configuration</CardTitle>
                    <CardDescription>
                      Creates shift templates used by staffing requirements and
                      schedule generation.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      downloadImportTemplate(
                        "shifts",
                        "shift_name,start_time,end_time,display_order,fatigue_penalty,difficulty_weight,is_overnight,status",
                      )
                    }
                  >
                    <Download className="size-4" />
                    Template
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => triggerImportInput("shifts")}
                  >
                    <Upload className="size-4" />
                    Import CSV
                  </Button>

                  <Input
                    id="shifts-csv-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        handleFileImport("shifts", file);
                      }

                      e.currentTarget.value = "";
                    }}
                  />

                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      toast.info("Manual shift add is frontend-only for now")
                    }
                  >
                    <Plus className="size-4" />
                    Add Shift
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Shift Name</TableHead>
                      <TableHead>Start Time</TableHead>
                      <TableHead>End Time</TableHead>
                      <TableHead>Overnight</TableHead>
                      <TableHead>Display Order</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {shiftTemplates.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-gray-500 py-6"
                        >
                          No shift templates found. Use Add Shift or Import CSV
                          to add records.
                        </TableCell>
                      </TableRow>
                    ) : (
                      shiftTemplates.map((shift, index) => (
                        <TableRow key={`shift-${shift.shift_template_id}`}>
                          <TableCell className="font-medium">
                            {shift.shift_name}
                          </TableCell>

                          <TableCell>{shift.start_time || "-"}</TableCell>

                          <TableCell>{shift.end_time || "-"}</TableCell>

                          <TableCell>
                            {shift.is_overnight ? "Yes" : "No"}
                          </TableCell>

                          <TableCell>
                            {shift.display_order ?? index + 1}
                          </TableCell>

                          <TableCell>
                            <Badge>Active</Badge>
                          </TableCell>

                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                toast.info(
                                  "Deactivate shift is frontend-only for now",
                                )
                              }
                            >
                              Deactivate
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Staffing Requirements */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="size-5 text-green-600" />
                  <div>
                    <CardTitle>Staffing Requirements</CardTitle>
                    <CardDescription>
                      Creates required staffing counts per account, shift, and
                      role.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      downloadImportTemplate(
                        "staffing",
                        "account_name,shift_name,role_name,required_count,status",
                      )
                    }
                  >
                    <Download className="size-4" />
                    Template
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => triggerImportInput("staffing")}
                  >
                    <Upload className="size-4" />
                    Import CSV
                  </Button>

                  <Input
                    id="staffing-csv-input"
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        handleFileImport("staffing", file);
                      }

                      e.currentTarget.value = "";
                    }}
                  />

                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      toast.info(
                        "Manual staffing requirement add is frontend-only for now",
                      )
                    }
                  >
                    <Plus className="size-4" />
                    Add Requirement
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Shift</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Required Count</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {accounts.length === 0 ||
                    shiftTemplates.length === 0 ||
                    staffingRoles.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500 py-6"
                        >
                          No staffing requirements found. Import accounts,
                          roles, and shifts first.
                        </TableCell>
                      </TableRow>
                    ) : (
                      accounts.flatMap((account) =>
                        shiftTemplates.flatMap((shift) =>
                          staffingRoles.map((role) => (
                            <TableRow
                              key={`staffing-${account.id}-${shift.shift_template_id}-${role.staffing_role_id}`}
                            >
                              <TableCell className="font-medium">
                                {account.name}
                              </TableCell>

                              <TableCell>{shift.shift_name}</TableCell>

                              <TableCell>
                                {role.role_name || role.role_key || "Role"}
                              </TableCell>

                              <TableCell>1</TableCell>

                              <TableCell>
                                <Badge>Active</Badge>
                              </TableCell>

                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    toast.info(
                                      "Remove staffing requirement is frontend-only for now",
                                    )
                                  }
                                >
                                  Remove
                                </Button>
                              </TableCell>
                            </TableRow>
                          )),
                        ),
                      )
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Import History */}
          <Card>
            <CardHeader>
              <CardTitle>Import History</CardTitle>
              <CardDescription>
                Recently imported CSV files in this session
              </CardDescription>
            </CardHeader>

            <CardContent>
              {importRecords.length > 0 ? (
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
                    {importRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="capitalize">
                          {record.category}
                        </TableCell>

                        <TableCell>{record.fileName}</TableCell>

                        <TableCell>{record.rowCount}</TableCell>

                        <TableCell>
                          <Badge
                            variant={
                              record.status === "success"
                                ? "default"
                                : "destructive"
                            }
                          >
                            {record.status}
                          </Badge>
                        </TableCell>

                        <TableCell>{record.importedAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-gray-500">No imports yet.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Assignments Tab }
        <TabsContent value="assignments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Assignments</CardTitle>
              <CardDescription>
                Override or remove existing assignments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Livestream</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Approved By</TableHead>
                        <TableHead>Approved Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignments.map((assignment) => {
                        const shiftInfo = getShiftInfo(assignment.shift);
                        return (
                          <TableRow key={assignment.id}>
                            <TableCell>
                              <span className="font-semibold text-blue-700">
                                {assignment.livestream}
                              </span>
                            </TableCell>
                            <TableCell>{assignment.day}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {assignment.shift} - {shiftInfo?.name}
                                </span>
                                <span className="text-xs text-gray-600">
                                  {shiftInfo?.time}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{assignment.role}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {assignment.employee}
                            </TableCell>
                            <TableCell>
                              {assignment.approvedBy ? (
                                <span className="text-sm">
                                  {assignment.approvedBy}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">
                                  Not approved
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {assignment.approvedAt ? (
                                <span className="text-sm">
                                  {new Date(
                                    assignment.approvedAt,
                                  ).toLocaleDateString()}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openOverrideDialog(assignment)}
                                  className="gap-2"
                                >
                                  <RefreshCw className="size-3" />
                                  Override
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    handleRemoveAssignment(assignment.id)
                                  }
                                >
                                  Remove
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4">
                  No assignments found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        */}
      </Tabs>
      {/* Add Account / Department Dialog */}
      <Dialog
        open={isAccountDepartmentDialogOpen}
        onOpenChange={(open) => {
          setIsAccountDepartmentDialogOpen(open);

          if (!open) {
            resetAccountDepartmentForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Account / Department</DialogTitle>
            <DialogDescription>
              Add a new department, or add an account under an existing
              department.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="department" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="department">Add Department</TabsTrigger>
              <TabsTrigger value="account">Add Account</TabsTrigger>
            </TabsList>

            <TabsContent value="department" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newDepartmentName">Department Name</Label>
                <Input
                  id="newDepartmentName"
                  placeholder="e.g. Sales"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newDepartmentAccountName">
                  Optional Account Name
                </Label>
                <Input
                  id="newDepartmentAccountName"
                  placeholder="e.g. Shopee"
                  value={newDepartmentAccountName}
                  onChange={(e) => setNewDepartmentAccountName(e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Leave this blank if you only want to create the department.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAccountDepartmentDialogOpen(false)}
                >
                  Cancel
                </Button>

                <Button onClick={handleAddDepartmentSubmit}>
                  Save Department
                </Button>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="account" className="space-y-4">
              <div className="space-y-2">
                <Label>Existing Department</Label>
                <Select
                  value={selectedExistingDepartment}
                  onValueChange={setSelectedExistingDepartment}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>

                  <SelectContent>
                    {Array.from(
                      new Set(
                        accountDepartmentRows.map((row) => row.department_name),
                      ),
                    ).map((departmentName) => (
                      <SelectItem key={departmentName} value={departmentName}>
                        {departmentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newAccountName">Account Name</Label>
                <Input
                  id="newAccountName"
                  placeholder="e.g. Mamypoko"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                />
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAccountDepartmentDialogOpen(false)}
                >
                  Cancel
                </Button>

                <Button onClick={handleAddAccountSubmit}>Save Account</Button>
              </DialogFooter>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
      {/* Account / Department Template Preview Dialog */}
      <Dialog
        open={isTemplatePreviewOpen}
        onOpenChange={setIsTemplatePreviewOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Account / Department CSV Template</DialogTitle>
            <DialogDescription>
              Your CSV must use exactly these columns. Department-only rows are
              allowed.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded border overflow-hidden bg-white">
            <img
              src="/account-department-template.png"
              alt="Account department CSV template preview"
              className="w-full h-auto"
            />
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>Accepted: department without account.</p>
            <p>Rejected: account without department.</p>
            <p>Rejected: duplicate account names.</p>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsTemplatePreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Employee Dialog */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Enter employee details to add them to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="employeeName">Employee Name</Label>
              <Input
                id="employeeName"
                placeholder="Enter employee name"
                value={newEmployeeName}
                onChange={(e) => setNewEmployeeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddEmployee();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeNickname">Nickname</Label>
              <Input
                id="employeeNickname"
                placeholder="Enter nickname"
                value={newEmployeeNickname}
                onChange={(e) => setNewEmployeeNickname(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddEmployee();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeEmail">Email</Label>
              <Input
                id="employeeEmail"
                placeholder="Enter employee email"
                value={newEmployeeEmail}
                onChange={(e) => setNewEmployeeEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddEmployee();
                  }
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="employeeContactNumber">Contact Number</Label>
              <Input
                id="employeeContactNumber"
                placeholder="Enter employee contact number"
                value={newEmployeeContactNumber}
                onChange={(e) => setNewEmployeeContactNumber(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddEmployee();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddEmployeeOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleAddEmployee}>Add Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Assignment Dialog */}
      <Dialog
        open={isOverrideDialogOpen}
        onOpenChange={setIsOverrideDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Assignment</DialogTitle>
            <DialogDescription>
              {selectedAssignment && (
                <div className="space-y-1 mt-2">
                  <div>
                    <strong>Livestream:</strong> {selectedAssignment.livestream}
                  </div>
                  <div>
                    <strong>Day:</strong> {selectedAssignment.day}
                  </div>
                  <div>
                    <strong>Shift:</strong>{" "}
                    {getShiftInfo(selectedAssignment.shift)?.name} (
                    {getShiftInfo(selectedAssignment.shift)?.time})
                  </div>
                  <div>
                    <strong>Role:</strong> {selectedAssignment.role}
                  </div>
                  <div>
                    <strong>Current Employee:</strong>{" "}
                    {selectedAssignment.employee}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="overrideEmployee">New Employee Name</Label>
              <Input
                id="overrideEmployee"
                placeholder="Enter employee name"
                value={overrideEmployee}
                onChange={(e) => setOverrideEmployee(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleOverrideAssignment();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsOverrideDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleOverrideAssignment}>
              Override Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Employee Dialog */}
      <Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Employee</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this employee? They will no
              longer be scheduled but their data will be preserved.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsConfirmDeleteOpen(false);
                setEmployeeToDelete(null);
              }}
            >
              No
            </Button>

            <Button variant="destructive" onClick={confirmRemoveEmployee}>
              Yes, Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAvailabilityDialogOpen}
        onOpenChange={setIsAvailabilityDialogOpen}
      >
        <DialogContent className="w-[95vw] !max-w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Weekly Availability -{" "}
              {selectedEmployeeForAvailability?.name}
            </DialogTitle>
            <DialogDescription>
              Click on any shift to toggle availability
            </DialogDescription>
          </DialogHeader>

          <div className="py-3">
            {selectedEmployeeForAvailability && (
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  {/* DAYS HEADER */}
                  <div className="grid grid-cols-8 gap-2 text-sm">
                    <div></div>
                    {DAYS.map((day) => (
                      <div
                        key={day}
                        className="p-2 text-center bg-gray-100 rounded"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  {/* SHIFTS GRID */}
                  {shiftTemplates.map((shift) => (
                    <div
                      key={shift.shift_name}
                      className="grid grid-cols-8 gap-2 mt-2 text-sm"
                    >
                      {/* SHIFT LABEL */}
                      <div className="p-2 bg-gray-100 rounded">
                        {shift.shift_name} - {shift.name}
                      </div>

                      {/* CELLS */}
                      {DAYS.map((day) => {
                        const isUnavailable = isSlotUnavailable(
                          selectedEmployeeForAvailability.id,
                          day,
                          shift.shift_name,
                        );

                        return (
                          <div
                            key={`${day}-${shift.shift_name}`}
                            onClick={() =>
                              toggleSlotAvailability(
                                selectedEmployeeForAvailability.id,
                                day,
                                shift.shift_name,
                              )
                            }
                            className={`p-2 rounded border cursor-pointer text-xs
                        ${
                          isUnavailable
                            ? "bg-gray-300"
                            : "bg-white hover:bg-blue-50"
                        }`}
                          >
                            {isUnavailable ? "Unavailable" : "Available"}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setIsAvailabilityDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Employee Template Preview Dialog */}
      <Dialog
        open={isEmployeesTemplatePreviewOpen}
        onOpenChange={setIsEmployeesTemplatePreviewOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Employee Data CSV Template</DialogTitle>
            <DialogDescription>
              Your CSV must use exactly these columns. This creates basic
              employee profiles only.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded border overflow-hidden bg-white">
            <img
              src="/employees-template.png"
              alt="Employee Data CSV template preview"
              className="w-full h-auto"
            />
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>Required columns: full_name, nickname, email, contact_number.</p>
            <p>
              Accepted: inactive employee with same email will be reactivated.
            </p>
            <p>
              Rejected: active duplicate email or duplicate email inside CSV.
            </p>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsEmployeesTemplatePreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Roles Template Preview Dialog */}
      <Dialog
        open={isRolesTemplatePreviewOpen}
        onOpenChange={setIsRolesTemplatePreviewOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Roles CSV Template</DialogTitle>
            <DialogDescription>
              Your CSV must use exactly these columns. Departments must already
              exist in Account / Department Data.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded border overflow-hidden bg-white">
            <img
              src="/roles-template.png"
              alt="Roles CSV template preview"
              className="w-full h-auto"
            />
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>Accepted: same role name under different departments.</p>
            <p>Rejected: department does not exist.</p>
            <p>Rejected: role already exists under the same department.</p>
          </div>

          <DialogFooter>
            <Button onClick={() => setIsRolesTemplatePreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Role Dialog */}
      <Dialog open={isAddRoleOpen} onOpenChange={setIsAddRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>
              Select an existing department and enter a role name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={newRoleDepartmentName}
                onValueChange={setNewRoleDepartmentName}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>

                <SelectContent>
                  {activeDepartmentOptions.map((departmentName) => (
                    <SelectItem key={departmentName} value={departmentName}>
                      {departmentName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input
                placeholder="e.g. Sales Specialist"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddRoleSubmit();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Admin Role</Label>
              <Select value={newRoleIsAdmin} onValueChange={setNewRoleIsAdmin}>
                <SelectTrigger>
                  <SelectValue placeholder="Select yes or no" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNewRoleDepartmentName("");
                setNewRoleName("");
                setNewRoleIsAdmin("no");
                setIsAddRoleOpen(false);
              }}
            >
              Cancel
            </Button>

            <Button onClick={handleAddRoleSubmit}>Save Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
