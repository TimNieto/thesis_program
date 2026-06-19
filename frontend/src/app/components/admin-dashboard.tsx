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

interface EmployeeAssignmentRow {
  employee_role_id: number;
  role_id: number;
  role_key?: string;
  role_name: string;
  is_admin: boolean;
  department_id: number;
  department_name: string;
}

interface Employee {
  id: number;
  name: string;
  nickname?: string;
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

  assignments?: EmployeeAssignmentRow[];
}

type EmployeeAssignmentDisplayRow =
  | {
      display_key: string;
      row_type: "employee";
      employee_id: number;
      employee_name: string;
      department_name: "";
      role_name: "";
      status: "Active" | "Inactive";
    }
  | {
      display_key: string;
      row_type: "assignment";
      employee_id: number;
      employee_name: string;
      employee_role_id: number;
      department_name: string;
      role_name: string;
      status: "Active" | "Inactive";
      is_admin: boolean;
    };

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
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");

  interface Holiday {
    id: string;
    name: string;
    date: string;
  }

  const [holidays, setHolidays] = useState<Holiday[]>([]);

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
    employeeAssignments: "/employee-assignments-import",
    shifts: "/shift-templates-import",
    staffing: "/staffing-requirements-import",
  };

  interface ImportRecord {
    id: string;
    category: ImportCategory;
    fileName: string;
    rowCount: number;
    importedAt: string;
    status: "success" | "error";
    importedBy?: string;
    errorMessage?: string | null;
  }

  const [importRecords, setImportRecords] = useState<ImportRecord[]>([]);

  const [isTemplatePreviewOpen, setIsTemplatePreviewOpen] = useState(false);
  const [isRolesTemplatePreviewOpen, setIsRolesTemplatePreviewOpen] =
    useState(false);
  const [isEmployeesTemplatePreviewOpen, setIsEmployeesTemplatePreviewOpen] =
    useState(false);
  const [
    isEmployeeAssignmentsTemplatePreviewOpen,
    setIsEmployeeAssignmentsTemplatePreviewOpen,
  ] = useState(false);
  const [
    isShiftTemplatesTemplatePreviewOpen,
    setIsShiftTemplatesTemplatePreviewOpen,
  ] = useState(false);
  const [
    isStaffingRequirementsTemplatePreviewOpen,
    setIsStaffingRequirementsTemplatePreviewOpen,
  ] = useState(false);

  const [isAddRoleOpen, setIsAddRoleOpen] = useState(false);
  const [newRoleDepartmentName, setNewRoleDepartmentName] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleIsAdmin, setNewRoleIsAdmin] = useState("no");

  const [isAddAssignmentOpen, setIsAddAssignmentOpen] = useState(false);
  const [newAssignmentEmployeeId, setNewAssignmentEmployeeId] = useState("");
  const [newAssignmentDepartmentName, setNewAssignmentDepartmentName] =
    useState("");
  const [newAssignmentRoleName, setNewAssignmentRoleName] = useState("");

  const [isAccountDepartmentDialogOpen, setIsAccountDepartmentDialogOpen] =
    useState(false);

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [newDepartmentAccountName, setNewDepartmentAccountName] = useState("");

  const [selectedExistingDepartment, setSelectedExistingDepartment] =
    useState("");
  const [newAccountName, setNewAccountName] = useState("");

  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);

  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [newShiftAccountId, setNewShiftAccountId] = useState("");
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftStartTime, setNewShiftStartTime] = useState("");
  const [newShiftEndTime, setNewShiftEndTime] = useState("");

  const [staffingRoles, setStaffingRoles] = useState<any[]>([]);
  const [staffingRequirements, setStaffingRequirements] = useState<any[]>([]);

  const [isAddRequirementOpen, setIsAddRequirementOpen] = useState(false);
  const [newRequirementAccountId, setNewRequirementAccountId] = useState("");
  const [newRequirementShiftTemplateId, setNewRequirementShiftTemplateId] =
    useState("");
  const [newRequirementRoleId, setNewRequirementRoleId] = useState("");
  const [newRequirementRequiredCount, setNewRequirementRequiredCount] =
    useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [requests, setRequests] = useState<Request[]>([]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Employee Management States
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeContactNumber, setNewEmployeeContactNumber] = useState("");
  const [newEmployeeNickname, setNewEmployeeNickname] = useState("");

  const [isRoleOverrideOpen, setIsRoleOverrideOpen] = useState(false);
  const [selectedEmployeeForRoles, setSelectedEmployeeForRoles] =
    useState<Employee | null>(null);

  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);

  const [accountRolePrefs, setAccountRolePrefs] = useState<
    Record<number, Record<number, boolean>>
  >({});

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

  const [accountDepartmentToDeactivate, setAccountDepartmentToDeactivate] =
    useState<AccountDepartmentRow | null>(null);

  const [roleToDeactivate, setRoleToDeactivate] = useState<any | null>(null);

  const [shiftToDeactivate, setShiftToDeactivate] = useState<any | null>(null);

  const [requirementToDeactivate, setRequirementToDeactivate] = useState<
    any | null
  >(null);

  const [assignmentToDeactivate, setAssignmentToDeactivate] = useState<
    number | null
  >(null);

  const [assignmentDeactivatePreview, setAssignmentDeactivatePreview] =
    useState<any | null>(null);

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
        const departmentCompare = String(a.department_name || "").localeCompare(
          String(b.department_name || ""),
        );

        if (departmentCompare !== 0) {
          return departmentCompare;
        }

        const accountCompare = String(a.account_name || "").localeCompare(
          String(b.account_name || ""),
        );

        if (accountCompare !== 0) {
          return accountCompare;
        }

        const aTime = String(a.start_time || "00:00:00");
        const bTime = String(b.start_time || "00:00:00");

        if (aTime !== bTime) {
          return aTime.localeCompare(bTime);
        }

        return String(a.shift_name || "").localeCompare(
          String(b.shift_name || ""),
        );
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
        setStaffingRequirements([]);
        return;
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/staffing-requirements?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to load staffing requirements");
      }

      setStaffingRoles(Array.isArray(data.roles) ? data.roles : []);
      setStaffingRequirements(
        Array.isArray(data.requirements) ? data.requirements : [],
      );
    } catch (err) {
      console.error("Failed to load staffing requirements", err);
      setStaffingRoles([]);
      setStaffingRequirements([]);
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

  const fetchHolidays = async () => {
    if (!currentUser.company_id) {
      setHolidays([]);
      return;
    }

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/holidays?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to load holidays");
      }

      setHolidays(
        (Array.isArray(data) ? data : []).map((holiday: any) => ({
          id: String(holiday.holiday_id),
          name: holiday.holiday_name,
          date: holiday.holiday_date,
        })),
      );
    } catch (err) {
      console.error("Failed to load holidays", err);
      setHolidays([]);
    }
  };

  const fetchEmployeeAccountPreferences = async (employeeId: number) => {
    if (!currentUser.company_id) return {};

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/employees/${employeeId}/account-preferences?company_id=${currentUser.company_id}`,
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to load account preferences");
      }

      const matrix: Record<number, Record<number, boolean>> = {};

      for (const pref of Array.isArray(data) ? data : []) {
        const accountId = Number(pref.account_id);
        const roleId = Number(pref.role_id);

        if (!matrix[accountId]) {
          matrix[accountId] = {};
        }

        matrix[accountId][roleId] = true;
      }

      return matrix;
    } catch (err) {
      console.error("Failed to load account preferences", err);
      return {};
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
        await fetchImportHistory();
        await fetchHolidays();
      } finally {
        setIsLoading(false);
      }
    };

    loadAdminData();
  }, [currentUser.role, currentUser.company_id]);

  const handleAddHoliday = async () => {
    if (!currentUser.company_id) {
      toast.error("No company selected");
      return;
    }

    if (!newHolidayName.trim()) {
      toast.error("Please enter a holiday name");
      return;
    }

    if (!newHolidayDate) {
      toast.error("Please select a date");
      return;
    }

    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/holidays",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentUser.company_id,
            holiday_name: newHolidayName.trim(),
            holiday_date: newHolidayDate,
          }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to save holiday");
      }

      setNewHolidayName("");
      setNewHolidayDate("");

      await fetchHolidays();

      toast.success(data?.message || "Holiday added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add holiday");
    }
  };

  const handleRemoveHoliday = async (id: string) => {
    if (!currentUser.company_id) {
      toast.error("No company selected");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to remove this holiday?",
    );

    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/holidays/${id}?company_id=${currentUser.company_id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to remove holiday");
      }

      await fetchHolidays();

      toast.success(data?.message || "Holiday removed");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to remove holiday",
      );
    }
  };

  const fetchImportHistory = async () => {
    try {
      if (!currentUser.company_id) {
        setImportRecords([]);
        return;
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/import-history?company_id=${currentUser.company_id}&limit=5`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to load import history");
      }

      setImportRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load import history", err);
      setImportRecords([]);
    }
  };

  const saveImportHistory = async (
    category: ImportCategory,
    fileName: string,
    rowCount: number,
    status: "success" | "error",
    errorMessage?: string,
  ) => {
    if (!currentUser.company_id) {
      return;
    }

    try {
      await fetch(
        "https://backend-production-6e75.up.railway.app/import-history",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentUser.company_id,
            imported_by_employee_id: currentUser.id,
            category,
            file_name: fileName,
            row_count: rowCount,
            status,
            error_message: errorMessage || null,
          }),
        },
      );

      await fetchImportHistory();
    } catch (err) {
      console.error("Failed to save import history", err);
    }
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

      await saveImportHistory(category, file.name, rows.length - 1, "success");

      await refreshAfterImport(category);

      toast.success(data?.message || `Imported ${rows.length - 1} rows`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";

      await saveImportHistory(category, file.name, 0, "error", msg);

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
    } finally {
      setAccountDepartmentToDeactivate(null);
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
    } finally {
      setRoleToDeactivate(null);
    }
  };

  const resetAddAssignmentForm = () => {
    setNewAssignmentEmployeeId("");
    setNewAssignmentDepartmentName("");
    setNewAssignmentRoleName("");
  };

  const resetAddShiftForm = () => {
    setNewShiftAccountId("");
    setNewShiftName("");
    setNewShiftStartTime("");
    setNewShiftEndTime("");
  };

  const resetAddRequirementForm = () => {
    setNewRequirementAccountId("");
    setNewRequirementShiftTemplateId("");
    setNewRequirementRoleId("");
    setNewRequirementRequiredCount("");
  };

  const handleAddShiftSubmit = async () => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      if (!newShiftAccountId) {
        throw new Error("Please select an account");
      }

      if (!newShiftName.trim()) {
        throw new Error("Shift name is required");
      }

      if (!newShiftStartTime || !newShiftEndTime) {
        throw new Error("Start and end time are required");
      }

      if (newShiftStartTime === newShiftEndTime) {
        throw new Error("Start and end time cannot be identical");
      }

      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/shift-templates",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentUser.company_id,
            account_id: Number(newShiftAccountId),
            shift_name: newShiftName,
            start_time: newShiftStartTime,
            end_time: newShiftEndTime,
          }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : data?.detail?.message || "Failed to add shift",
        );
      }

      await fetchShiftTemplates();

      resetAddShiftForm();
      setIsAddShiftOpen(false);

      toast.success(data?.message || "Shift added");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add shift");
    }
  };

  const handleAddRequirementSubmit = async () => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      if (!newRequirementAccountId) {
        throw new Error("Please select an account");
      }

      if (!newRequirementShiftTemplateId) {
        throw new Error("Please select a shift");
      }

      if (!newRequirementRoleId) {
        throw new Error("Please select a role");
      }

      if (!newRequirementRequiredCount.trim()) {
        throw new Error("Required count is required");
      }

      const requiredCount = Number(newRequirementRequiredCount);

      if (!Number.isInteger(requiredCount)) {
        throw new Error("Required count must be a whole number");
      }

      if (requiredCount < 0) {
        throw new Error("Required count cannot be negative");
      }

      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/staffing-requirements",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentUser.company_id,
            requirements: [
              {
                account_id: Number(newRequirementAccountId),
                shift_template_id: Number(newRequirementShiftTemplateId),
                role_id: Number(newRequirementRoleId),
                required_count: requiredCount,
              },
            ],
          }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : data?.detail?.message || "Failed to save staffing requirement",
        );
      }

      await fetchStaffingRequirements();

      resetAddRequirementForm();
      setIsAddRequirementOpen(false);

      toast.success(data?.message || "Staffing requirement saved");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to save staffing requirement",
      );
    }
  };

  const handleDeactivateRequirement = (requirement: any) => {
    setRequirementToDeactivate(requirement);
  };

  const confirmDeactivateRequirement = async () => {
    if (!requirementToDeactivate) return;

    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      const requirementId = requirementToDeactivate.requirement_id;

      if (!requirementId) {
        throw new Error("Invalid staffing requirement");
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/staffing-requirements/${requirementId}?company_id=${currentUser.company_id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : data?.detail?.message ||
                "Failed to deactivate staffing requirement",
        );
      }

      await fetchStaffingRequirements();

      toast.success(data?.message || "Staffing requirement deactivated");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to deactivate staffing requirement",
      );
    } finally {
      setRequirementToDeactivate(null);
    }
  };

  const handleDeactivateShift = (shift: any) => {
    setShiftToDeactivate(shift);
  };

  const confirmDeactivateShift = async () => {
    if (!shiftToDeactivate) return;

    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      const shiftTemplateId = shiftToDeactivate.shift_template_id;

      if (!shiftTemplateId) {
        throw new Error("Invalid shift template");
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/shift-templates/${shiftTemplateId}?company_id=${currentUser.company_id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : data?.detail?.message || "Failed to deactivate shift",
        );
      }

      await fetchShiftTemplates();
      await fetchStaffingRequirements();

      toast.success(data?.message || "Shift deactivated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to deactivate shift",
      );
    } finally {
      setShiftToDeactivate(null);
    }
  };

  const handleAddAssignmentSubmit = async () => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      if (!newAssignmentEmployeeId) {
        throw new Error("Please select an employee");
      }

      if (!newAssignmentDepartmentName) {
        throw new Error("Please select a department");
      }

      if (!newAssignmentRoleName) {
        throw new Error("Please select a role");
      }

      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/employee-assignments",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentUser.company_id,
            employee_id: Number(newAssignmentEmployeeId),
            department_name: newAssignmentDepartmentName,
            role_name: newAssignmentRoleName,
          }),
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          typeof data?.detail === "string"
            ? data.detail
            : data?.detail?.message || "Failed to add employee assignment",
        );
      }

      await fetchEmployees();

      resetAddAssignmentForm();
      setIsAddAssignmentOpen(false);

      toast.success(data?.message || "Employee assignment added");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to add employee assignment",
      );
    }
  };

  const openRoleOverrideDialog = async (employee: Employee) => {
    setSelectedEmployeeForRoles(employee);

    const existingRoleIds = (employee.assignments || []).map((assignment) =>
      Number(assignment.role_id),
    );

    setSelectedRoleIds(existingRoleIds);

    const prefs = await fetchEmployeeAccountPreferences(employee.id);
    setAccountRolePrefs(prefs);

    setIsRoleOverrideOpen(true);
  };

  const buildAccountPreferencePayload = () => {
    const preferences: any[] = [];

    for (const account of roleDepartmentAccounts) {
      const accountId = Number(account.account_id);

      for (const role of selectedNonAdminRoles) {
        const roleId = Number(role.role_id);

        if (accountRolePrefs[accountId]?.[roleId]) {
          preferences.push({
            account_name: account.account_name,
            role_id: roleId,
          });
        }
      }
    }

    return preferences;
  };

  const handleSaveRoleOverride = async () => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      if (!selectedEmployeeForRoles) {
        throw new Error("No employee selected");
      }

      if (selectedRoleIds.length === 0) {
        throw new Error("Please select at least one role");
      }

      const roleRes = await fetch(
        `https://backend-production-6e75.up.railway.app/employees/${selectedEmployeeForRoles.id}/roles`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: currentUser.company_id,
            role_ids: selectedRoleIds,
          }),
        },
      );

      const roleData = await roleRes.json().catch(() => null);

      if (!roleRes.ok) {
        throw new Error(roleData?.detail || "Failed to update roles");
      }

      const hasAdminRole = selectedRoles.some((role) => Boolean(role.is_admin));

      if (!hasAdminRole) {
        const prefsRes = await fetch(
          `https://backend-production-6e75.up.railway.app/employees/${selectedEmployeeForRoles.id}/account-preferences`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              company_id: currentUser.company_id,
              preferences: buildAccountPreferencePayload(),
            }),
          },
        );

        const prefsData = await prefsRes.json().catch(() => null);

        if (!prefsRes.ok) {
          throw new Error(
            prefsData?.detail || "Failed to update account preferences",
          );
        }
      }

      await fetchEmployees();

      setIsRoleOverrideOpen(false);
      setSelectedEmployeeForRoles(null);
      setSelectedRoleIds([]);
      setAccountRolePrefs({});

      toast.success("Employee roles updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update employee roles",
      );
    }
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

  const activeShiftAccountOptions = accountDepartmentRows
    .filter((row) => {
      return (
        row.department_is_active &&
        row.account_id !== null &&
        row.account_is_active
      );
    })
    .sort((a, b) => {
      const departmentCompare = String(a.department_name || "").localeCompare(
        String(b.department_name || ""),
      );

      if (departmentCompare !== 0) {
        return departmentCompare;
      }

      return String(a.account_name || "").localeCompare(
        String(b.account_name || ""),
      );
    });

  const getGlobalShiftName = (shift: any) => {
    const rawShiftName = String(shift.shift_name || "").trim();
    const accountName = String(shift.account_name || "").trim();

    if (!rawShiftName) return "";

    if (
      accountName &&
      rawShiftName.toLowerCase().startsWith(`${accountName.toLowerCase()} - `)
    ) {
      return rawShiftName.slice(accountName.length + 3).trim();
    }

    return rawShiftName;
  };

  const globalAvailabilityShifts = Array.from(
    shiftTemplates
      .reduce((map, shift) => {
        const shiftName = String(shift.shift_name || "").trim();

        if (!shiftName) return map;

        const key = shiftName.toLowerCase();

        if (!map.has(key)) {
          map.set(key, {
            shift_name: shift.shift_name,
            start_time: shift.start_time,
            end_time: shift.end_time,
            representative_shift_template_id: shift.shift_template_id,
          });
        }

        return map;
      }, new Map<string, any>())
      .values(),
  ).sort((a, b) => {
    const aTime = String(a.start_time || "00:00:00");
    const bTime = String(b.start_time || "00:00:00");

    if (aTime !== bTime) return aTime.localeCompare(bTime);

    return String(a.shift_name || "").localeCompare(String(b.shift_name || ""));
  });

  const selectedRequirementAccountInfo = activeShiftAccountOptions.find(
    (row) => String(row.account_id) === newRequirementAccountId,
  );

  const activeRequirementShiftOptions = shiftTemplates
    .filter((shift) => {
      return String(shift.account_id) === newRequirementAccountId;
    })
    .sort((a, b) => {
      const aTime = String(a.start_time || "00:00:00");
      const bTime = String(b.start_time || "00:00:00");

      if (aTime !== bTime) {
        return aTime.localeCompare(bTime);
      }

      return String(a.shift_name || "").localeCompare(
        String(b.shift_name || ""),
      );
    });

  const activeRequirementRoleOptions = staffingRoles
    .filter((role) => {
      if (!selectedRequirementAccountInfo) {
        return false;
      }

      return (
        String(role.department_name || "").toLowerCase() ===
        String(
          selectedRequirementAccountInfo.department_name || "",
        ).toLowerCase()
      );
    })
    .sort((a, b) =>
      String(a.role_name || "").localeCompare(String(b.role_name || "")),
    );

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

  const activeAssignmentRoleOptions = staffingRoles
    .filter((role) => {
      if (!newAssignmentDepartmentName) {
        return false;
      }

      return (
        String(role.department_name || "").toLowerCase() ===
        newAssignmentDepartmentName.toLowerCase()
      );
    })
    .sort((a, b) =>
      String(a.role_name || "").localeCompare(String(b.role_name || "")),
    );

  const groupedEmployeeAssignmentRows: EmployeeAssignmentDisplayRow[] =
    employees
      .filter((employee) => {
        return (
          Array.isArray(employee.assignments) && employee.assignments.length > 0
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap((employee) => {
        const assignments = [...(employee.assignments || [])].sort((a, b) =>
          `${a.department_name}-${a.role_name}`.localeCompare(
            `${b.department_name}-${b.role_name}`,
          ),
        );

        return [
          {
            display_key: `employee-assignment-group-${employee.id}`,
            row_type: "employee" as const,
            employee_id: employee.id,
            employee_name: employee.name,
            department_name: "" as const,
            role_name: "" as const,
            status: employee.status,
          },
          ...assignments.map((assignment) => ({
            display_key: `employee-assignment-${assignment.employee_role_id}`,
            row_type: "assignment" as const,
            employee_id: employee.id,
            employee_name: employee.name,
            employee_role_id: assignment.employee_role_id,
            department_name: assignment.department_name,
            role_name: assignment.role_name,
            status: employee.status,
            is_admin: assignment.is_admin,
          })),
        ];
      });

  const selectedRoles = staffingRoles.filter((role) =>
    selectedRoleIds.includes(Number(role.role_id)),
  );

  const selectedDepartmentName =
    selectedRoles.length > 0 ? selectedRoles[0].department_name : null;

  const selectedIsAdmin =
    selectedRoles.length > 0 ? Boolean(selectedRoles[0].is_admin) : null;

  const selectedNonAdminRoles = selectedRoles.filter(
    (role) => !Boolean(role.is_admin),
  );

  const rolesByDepartment = staffingRoles.reduce(
    (groups: Record<string, any[]>, role) => {
      const department = role.department_name || "None";

      if (!groups[department]) {
        groups[department] = [];
      }

      groups[department].push(role);

      return groups;
    },
    {},
  );

  const isRoleCheckboxDisabled = (role: any) => {
    if (selectedRoles.length === 0) return false;

    const roleDepartment = role.department_name || "None";
    const roleIsAdmin = Boolean(role.is_admin);

    if (roleDepartment !== selectedDepartmentName) return true;
    if (roleIsAdmin !== selectedIsAdmin) return true;

    return false;
  };

  const roleDepartmentAccounts = accountDepartmentRows.filter((row) => {
    if (!selectedDepartmentName) return false;

    return (
      row.account_id &&
      row.account_name &&
      row.department_name === selectedDepartmentName
    );
  });

  const groupedShiftTemplateRows = Array.from(
    shiftTemplates
      .reduce(
        (map, shift) => {
          const departmentName = shift.department_name || "None";
          const departmentKey = String(departmentName).toLowerCase();

          const existing = map.get(departmentKey) ?? {
            departmentRow: {
              display_key: `shift-department-${departmentKey}`,
              row_type: "department" as const,
              department_name: departmentName,
            },
            shiftRows: [] as any[],
          };

          existing.shiftRows.push({
            ...shift,
            display_key: `shift-template-${shift.shift_template_id}`,
            row_type: "shift" as const,
          });

          map.set(departmentKey, existing);

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
            shiftRows: any[];
          }
        >(),
      )
      .values(),
  ).flatMap((group) => [group.departmentRow, ...group.shiftRows]);

  type StaffingRequirementDisplayRow =
    | {
        display_key: string;
        row_type: "department";
        department_name: string;
      }
    | {
        display_key: string;
        row_type: "account";
        department_name: string;
        account_name: string;
      }
    | {
        display_key: string;
        row_type: "shift";
        department_name: string;
        account_name: string;
        shift_name: string;
      }
    | {
        display_key: string;
        row_type: "requirement";
        requirement: any;
      };

  const accountDepartmentLookup = new Map(
    accountDepartmentRows
      .filter((row) => row.account_id !== null)
      .map((row) => [
        Number(row.account_id),
        {
          department_id: row.department_id,
          department_name: row.department_name,
          account_name: row.account_name,
        },
      ]),
  );

  const shiftTemplateLookup = new Map(
    shiftTemplates.map((shift) => [
      Number(shift.shift_template_id),
      {
        start_time: shift.start_time || "00:00:00",
        shift_name: shift.shift_name || "",
      },
    ]),
  );

  const groupedStaffingRequirementRows: StaffingRequirementDisplayRow[] =
    Array.from(
      [...staffingRequirements]
        .sort((a, b) => {
          const aAccountInfo = accountDepartmentLookup.get(
            Number(a.account_id),
          );
          const bAccountInfo = accountDepartmentLookup.get(
            Number(b.account_id),
          );

          const departmentCompare = String(
            aAccountInfo?.department_name || a.department_name || "",
          ).localeCompare(
            String(bAccountInfo?.department_name || b.department_name || ""),
          );

          if (departmentCompare !== 0) {
            return departmentCompare;
          }

          const accountCompare = String(a.account_name || "").localeCompare(
            String(b.account_name || ""),
          );

          if (accountCompare !== 0) {
            return accountCompare;
          }

          const aShiftInfo = shiftTemplateLookup.get(
            Number(a.shift_template_id),
          );
          const bShiftInfo = shiftTemplateLookup.get(
            Number(b.shift_template_id),
          );

          const shiftTimeCompare = String(
            aShiftInfo?.start_time || "00:00:00",
          ).localeCompare(String(bShiftInfo?.start_time || "00:00:00"));

          if (shiftTimeCompare !== 0) {
            return shiftTimeCompare;
          }

          const shiftCompare = String(a.shift_name || "").localeCompare(
            String(b.shift_name || ""),
          );

          if (shiftCompare !== 0) {
            return shiftCompare;
          }

          return String(a.role_name || "").localeCompare(
            String(b.role_name || ""),
          );
        })
        .reduce(
          (departmentMap, requirement) => {
            const accountInfo = accountDepartmentLookup.get(
              Number(requirement.account_id),
            );

            const departmentName =
              accountInfo?.department_name ||
              requirement.department_name ||
              "None";

            const departmentKey = String(
              accountInfo?.department_id ?? departmentName,
            ).toLowerCase();

            const accountName =
              requirement.account_name || accountInfo?.account_name || "None";

            const accountKey = String(
              requirement.account_id ?? accountName,
            ).toLowerCase();

            const shiftName = requirement.shift_name || "None";

            const shiftKey = String(
              requirement.shift_template_id ?? shiftName,
            ).toLowerCase();

            const departmentGroup = departmentMap.get(departmentKey) ?? {
              departmentName,
              accounts: new Map<
                string,
                {
                  accountName: string;
                  shifts: Map<
                    string,
                    {
                      shiftName: string;
                      requirements: any[];
                    }
                  >;
                }
              >(),
            };

            const accountGroup = departmentGroup.accounts.get(accountKey) ?? {
              accountName,
              shifts: new Map<
                string,
                {
                  shiftName: string;
                  requirements: any[];
                }
              >(),
            };

            const shiftGroup = accountGroup.shifts.get(shiftKey) ?? {
              shiftName,
              requirements: [],
            };

            shiftGroup.requirements.push(requirement);

            accountGroup.shifts.set(shiftKey, shiftGroup);
            departmentGroup.accounts.set(accountKey, accountGroup);
            departmentMap.set(departmentKey, departmentGroup);

            return departmentMap;
          },
          new Map<
            string,
            {
              departmentName: string;
              accounts: Map<
                string,
                {
                  accountName: string;
                  shifts: Map<
                    string,
                    {
                      shiftName: string;
                      requirements: any[];
                    }
                  >;
                }
              >;
            }
          >(),
        )
        .values(),
    ).flatMap((departmentGroup) => [
      {
        display_key: `staffing-department-${departmentGroup.departmentName}`,
        row_type: "department" as const,
        department_name: departmentGroup.departmentName,
      },
      ...Array.from(departmentGroup.accounts.values()).flatMap(
        (accountGroup) => [
          {
            display_key: `staffing-account-${departmentGroup.departmentName}-${accountGroup.accountName}`,
            row_type: "account" as const,
            department_name: departmentGroup.departmentName,
            account_name: accountGroup.accountName,
          },
          ...Array.from(accountGroup.shifts.values()).flatMap((shiftGroup) => [
            {
              display_key: `staffing-shift-${departmentGroup.departmentName}-${accountGroup.accountName}-${shiftGroup.shiftName}`,
              row_type: "shift" as const,
              department_name: departmentGroup.departmentName,
              account_name: accountGroup.accountName,
              shift_name: shiftGroup.shiftName,
            },
            ...shiftGroup.requirements.map((requirement) => ({
              display_key: `staffing-requirement-${
                requirement.requirement_id ??
                `${requirement.account_id}-${requirement.shift_template_id}-${requirement.role_id}`
              }`,
              row_type: "requirement" as const,
              requirement,
            })),
          ]),
        ],
      ),
    ]);

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

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/employees/${employeeToDelete}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.detail || "Failed to deactivate employee");
      }

      await fetchEmployees();

      toast.success(data?.message || "Employee deactivated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to deactivate employee",
      );
    } finally {
      setIsConfirmDeleteOpen(false);
      setEmployeeToDelete(null);
    }
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

  const handleDeactivateEmployeeAssignment = async (employeeRoleId: number) => {
    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      const previewRes = await fetch(
        `https://backend-production-6e75.up.railway.app/employee-assignments/${employeeRoleId}/deactivation-preview?company_id=${currentUser.company_id}`,
      );

      const previewData = await previewRes.json().catch(() => null);

      if (!previewRes.ok) {
        throw new Error(
          previewData?.detail || "Failed to load deactivation impact",
        );
      }

      setAssignmentToDeactivate(employeeRoleId);
      setAssignmentDeactivatePreview(previewData);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to load deactivation impact",
      );
    }
  };

  const confirmDeactivateEmployeeAssignment = async () => {
    if (!assignmentToDeactivate) return;

    try {
      if (!currentUser.company_id) {
        throw new Error("No company selected");
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/employee-assignments/${assignmentToDeactivate}?company_id=${currentUser.company_id}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.detail || "Failed to deactivate employee assignment",
        );
      }

      await fetchEmployees();

      toast.success(data?.message || "Employee assignment deactivated");
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to deactivate employee assignment",
      );
    } finally {
      setAssignmentToDeactivate(null);
      setAssignmentDeactivatePreview(null);
    }
  };

  // Day Off Management Functions
  const isSlotUnavailable = (
    employeeId: number,
    day: string,
    shiftName: number | string,
  ): boolean => {
    const emp = employeeAvailability[employeeId];

    if (!emp) return true;

    const dayData = emp[day.toLowerCase()];

    if (!dayData) return true;

    const shiftKey = String(shiftName).trim().toLowerCase();
    const shiftData = dayData[shiftKey];

    if (shiftData === undefined) return true;

    return !shiftData;
  };

  const toggleSlotAvailability = async (
    employeeId: number,
    day: string,
    shift: any,
  ) => {
    const shiftName = String(shift.shift_name || "").trim();

    if (!shiftName) {
      toast.error("Invalid shift name");
      return;
    }

    const isCurrentlyUnavailable = isSlotUnavailable(
      employeeId,
      day,
      shiftName,
    );

    try {
      await fetch(
        "https://backend-production-6e75.up.railway.app/availability/global",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employee_id: employeeId,
            company_id: currentUser.company_id,
            day_of_week: day.toLowerCase(),
            shift_name: shiftName,
            is_available: isCurrentlyUnavailable,
          }),
        },
      );

      await fetchAvailability();
    } catch (err) {
      console.error("Failed to update availability", err);
      toast.error("Failed to update availability");
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

        const rawShiftName =
          row.shift_name ||
          row.preferred_shift ||
          row.shift_type ||
          row.shift_template_name;

        if (!rawShiftName) return;

        const empId = Number(row.employee_id);
        const day = String(row.day_of_week).toLowerCase();
        const shiftKey = String(rawShiftName).trim().toLowerCase();

        if (!transformed[empId]) {
          transformed[empId] = {};
        }

        if (!transformed[empId][day]) {
          transformed[empId][day] = {};
        }

        transformed[empId][day][shiftKey] = row.is_available;
      });

      console.log("GLOBAL AVAILABILITY MAP:", transformed);

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

  const employeeSearchTerm = employeeSearchQuery.trim().toLowerCase();

  const filteredEmployeeManagementEmployees = [...employees]
    .filter((employee) => {
      if (!employeeSearchTerm) {
        return true;
      }

      return [String(employee.id), employee.name, employee.role].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(employeeSearchTerm),
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Statistics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "Active").length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const totalAssignments = assignments.length;
  const totalRequiredStaffingSlots = staffingRequirements.reduce(
    (total, requirement) => total + Number(requirement.required_count || 0),
    0,
  );

  const totalSlots = DAYS.length * totalRequiredStaffingSlots;

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
            Data & Imports
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Employee Management</CardTitle>
                  <CardDescription>
                    Add, remove, or modify employee details
                  </CardDescription>
                </div>

                <div className="relative w-full max-w-xs">
                  <Input
                    value={employeeSearchQuery}
                    onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                    placeholder="Search ID, name, or role"
                    className="pr-9"
                  />

                  {employeeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setEmployeeSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 text-gray-400 hover:text-gray-700"
                      aria-label="Clear employee search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">ID</TableHead>
                      <TableHead className="w-[28%]">Name</TableHead>
                      <TableHead className="w-[24%]">Role</TableHead>
                      <TableHead className="w-[12%]">Status</TableHead>
                      <TableHead className="w-[16%]">Joined Date</TableHead>
                      <TableHead className="w-[140px] text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployeeManagementEmployees.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-gray-500 py-6"
                        >
                          {employees.length === 0
                            ? "No employees found. Import employees to populate"
                            : "No employees match your search"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredEmployeeManagementEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium text-gray-600 truncate">
                            {employee.id}
                          </TableCell>

                          <TableCell className="font-medium truncate">
                            {employee.name}
                          </TableCell>

                          <TableCell className="truncate">
                            {employee.role || "None"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                employee.status === "Active"
                                  ? "default"
                                  : "secondary"
                              }
                              className="cursor-pointer"
                              onClick={() => toggleEmployeeStatus(employee.id)}
                            >
                              {employee.status}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            {new Date(employee.joinedDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRoleOverrideDialog(employee)}
                                className="gap-2"
                              >
                                <UserSquare2 className="size-4" />
                                Roles
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

          {/* Availability Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarOff className="size-5 text-blue-600" />
                    Employee Availability
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
                      {[...employees]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((employee) => (
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

                      {globalAvailabilityShifts.map((shift) => (
                        <div
                          key={`availability-shift-${shift.shift_name}`}
                          className="grid grid-cols-8 gap-2 mt-2"
                        >
                          <div className="p-3 font-medium bg-gray-100 rounded flex flex-col justify-center">
                            <div>{shift.shift_name}</div>
                            <div className="text-xs text-gray-600">
                              {(shift.start_time || "").slice(0, 5)} -{" "}
                              {(shift.end_time || "").slice(0, 5)}
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
                                    shift,
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
                                setAccountDepartmentToDeactivate(row)
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
                          colSpan={7}
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
                                onClick={() => setRoleToDeactivate(row)}
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
                      <TableHead className="w-[18%]">Name</TableHead>
                      <TableHead className="w-[14%]">Nickname</TableHead>
                      <TableHead className="w-[24%]">Email</TableHead>
                      <TableHead className="w-[16%]">Contact Number</TableHead>
                      <TableHead className="w-[12%]">Joined Date</TableHead>
                      <TableHead className="w-[8%]">Status</TableHead>
                      <TableHead className={actionCellClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {employees.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
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
                            {employee.nickname || "—"}
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
                      Connects existing employees to departments and roles.
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      setIsEmployeeAssignmentsTemplatePreviewOpen(true)
                    }
                  >
                    <Download className="size-4" />
                    View Template
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
                    onClick={() => {
                      resetAddAssignmentForm();
                      setIsAddAssignmentOpen(true);
                    }}
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
                      <TableHead className="w-[30%]">Employee</TableHead>
                      <TableHead className="w-[30%]">Department</TableHead>
                      <TableHead className="w-[20%]">Role</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className={actionCellClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {groupedEmployeeAssignmentRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="text-center text-gray-500 py-6"
                        >
                          No employee assignments found. Import employees,
                          departments, and roles first.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupedEmployeeAssignmentRows.map((row) => (
                        <TableRow key={row.display_key} className="h-12">
                          <TableCell className="font-medium truncate">
                            {row.row_type === "employee"
                              ? row.employee_name
                              : ""}
                          </TableCell>

                          <TableCell
                            className={
                              row.row_type === "assignment"
                                ? "truncate pl-6"
                                : "truncate text-gray-400"
                            }
                          >
                            {row.row_type === "assignment"
                              ? row.department_name
                              : ""}
                          </TableCell>

                          <TableCell
                            className={
                              row.row_type === "assignment"
                                ? "font-medium truncate"
                                : "truncate text-gray-400"
                            }
                          >
                            {row.row_type === "assignment" ? row.role_name : ""}
                          </TableCell>

                          <TableCell>
                            {row.row_type === "assignment"
                              ? renderStatusBadge(row.status)
                              : ""}
                          </TableCell>
                          <TableCell className={actionCellClass}>
                            {row.row_type === "assignment" && (
                              <Button
                                size="sm"
                                className={dangerSmallButtonClass}
                                onClick={() =>
                                  handleDeactivateEmployeeAssignment(
                                    row.employee_role_id,
                                  )
                                }
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
                    onClick={() => setIsShiftTemplatesTemplatePreviewOpen(true)}
                  >
                    <Download className="size-4" />
                    View Template
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
                    onClick={() => {
                      resetAddShiftForm();
                      setIsAddShiftOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Add Shift
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
                      <TableHead className="w-[20%]">Account Name</TableHead>
                      <TableHead className="w-[18%]">Shift Name</TableHead>
                      <TableHead className="w-[14%]">Start Time</TableHead>
                      <TableHead className="w-[14%]">End Time</TableHead>
                      <TableHead className="w-[8%]">Status</TableHead>
                      <TableHead className={actionCellClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {groupedShiftTemplateRows.length === 0 ? (
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
                      groupedShiftTemplateRows.map((row: any) => (
                        <TableRow key={row.display_key} className="h-12">
                          <TableCell className="font-medium truncate">
                            {row.row_type === "department"
                              ? row.department_name
                              : ""}
                          </TableCell>

                          <TableCell
                            className={
                              row.row_type === "shift"
                                ? "font-medium truncate pl-6"
                                : "truncate text-gray-400"
                            }
                          >
                            {row.row_type === "shift" ? row.account_name : ""}
                          </TableCell>

                          <TableCell
                            className={
                              row.row_type === "shift"
                                ? "font-medium truncate"
                                : "truncate text-gray-400"
                            }
                          >
                            {row.row_type === "shift" ? row.shift_name : ""}
                          </TableCell>

                          <TableCell>
                            {row.row_type === "shift"
                              ? row.start_time || "-"
                              : ""}
                          </TableCell>

                          <TableCell>
                            {row.row_type === "shift"
                              ? row.end_time || "-"
                              : ""}
                          </TableCell>

                          <TableCell>
                            {row.row_type === "shift"
                              ? renderStatusBadge("Active")
                              : ""}
                          </TableCell>

                          <TableCell className={actionCellClass}>
                            {row.row_type === "shift" && (
                              <Button
                                size="sm"
                                className={dangerSmallButtonClass}
                                onClick={() => handleDeactivateShift(row)}
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
                      setIsStaffingRequirementsTemplatePreviewOpen(true)
                    }
                  >
                    <Download className="size-4" />
                    View Template
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
                    onClick={() => {
                      resetAddRequirementForm();
                      setIsAddRequirementOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    Add Requirement
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <Table className={tableClass}>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[16%]">Department</TableHead>
                      <TableHead className="w-[16%]">Account</TableHead>
                      <TableHead className="w-[16%]">Shift</TableHead>
                      <TableHead className="w-[24%]">Role</TableHead>
                      <TableHead className="w-[12%]">Required Count</TableHead>
                      <TableHead className="w-[8%]">Status</TableHead>
                      <TableHead className={actionCellClass}>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {staffingRequirements.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-gray-500 py-6"
                        >
                          No staffing requirements found. Import or add staffing
                          requirements first.
                        </TableCell>
                      </TableRow>
                    ) : (
                      groupedStaffingRequirementRows.map((row) => {
                        if (row.row_type === "department") {
                          return (
                            <TableRow
                              key={row.display_key}
                              className="bg-gray-50 h-12"
                            >
                              <TableCell className="font-semibold truncate">
                                {row.department_name}
                              </TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell />
                              <TableCell />
                              <TableCell />
                              <TableCell />
                            </TableRow>
                          );
                        }

                        if (row.row_type === "account") {
                          return (
                            <TableRow key={row.display_key} className="h-12">
                              <TableCell />
                              <TableCell className="pl-4 font-medium text-gray-800 truncate">
                                {row.account_name}
                              </TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell />
                              <TableCell />
                              <TableCell />
                            </TableRow>
                          );
                        }

                        if (row.row_type === "shift") {
                          return (
                            <TableRow key={row.display_key} className="h-12">
                              <TableCell />
                              <TableCell />
                              <TableCell className="pl-4 font-medium text-gray-700 truncate">
                                {row.shift_name}
                              </TableCell>
                              <TableCell />
                              <TableCell />
                              <TableCell />
                              <TableCell />
                            </TableRow>
                          );
                        }

                        const requirement = row.requirement;

                        return (
                          <TableRow key={row.display_key} className="h-12">
                            <TableCell />
                            <TableCell />
                            <TableCell />

                            <TableCell className="pl-4 truncate">
                              {requirement.role_name ||
                                requirement.role_key ||
                                "—"}
                            </TableCell>

                            <TableCell>
                              {requirement.required_count ?? 0}
                            </TableCell>

                            <TableCell>
                              <Badge
                                variant={
                                  requirement.is_active
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {requirement.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>

                            <TableCell className={actionCellClass}>
                              <Button
                                size="sm"
                                className={dangerSmallButtonClass}
                                onClick={() =>
                                  handleDeactivateRequirement(requirement)
                                }
                              >
                                Deactivate
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
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
                Latest 5 imported CSV files for this company
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

      {/* Role Override Dialog */}
      <Dialog open={isRoleOverrideOpen} onOpenChange={setIsRoleOverrideOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Roles & Account Preferences</DialogTitle>
            <DialogDescription>
              Override employee roles and configure account scheduling
              permissions.
            </DialogDescription>
          </DialogHeader>

          {selectedEmployeeForRoles && (
            <div className="space-y-6">
              <div>
                <p className="font-medium">{selectedEmployeeForRoles.name}</p>
                <p className="text-sm text-gray-500">
                  Current role: {selectedEmployeeForRoles.role || "None"}
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Role Override</h3>

                {Object.entries(rolesByDepartment).map(
                  ([department, roles]) => (
                    <div
                      key={department}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="font-medium">{department}</div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {roles.map((role: any) => {
                          const roleId = Number(role.role_id);
                          const checked = selectedRoleIds.includes(roleId);
                          const disabled = isRoleCheckboxDisabled(role);

                          return (
                            <label
                              key={roleId}
                              className={`flex items-center gap-2 rounded border p-3 ${
                                disabled ? "opacity-50" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled}
                                onChange={(event) => {
                                  const isChecked = event.target.checked;

                                  setSelectedRoleIds((prev) => {
                                    if (isChecked) {
                                      return [...prev, roleId];
                                    }

                                    return prev.filter((id) => id !== roleId);
                                  });
                                }}
                              />

                              <span>
                                {role.role_name}
                                {role.is_admin && (
                                  <span className="ml-2 text-xs text-blue-600">
                                    Admin access
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ),
                )}
              </div>

              {selectedIsAdmin === true && (
                <div className="rounded-lg border bg-gray-50 p-4 text-sm text-gray-600">
                  Admin roles are not schedule roles. Account preferences are
                  disabled for admin-role employees.
                </div>
              )}

              {selectedIsAdmin === false &&
                selectedNonAdminRoles.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold">Account Preferences</h3>

                    <div className="overflow-x-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            {selectedNonAdminRoles.map((role) => (
                              <TableHead key={role.role_id}>
                                {role.role_name}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>

                        <TableBody>
                          {roleDepartmentAccounts.length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={1 + selectedNonAdminRoles.length}
                                className="text-center text-gray-500 py-6"
                              >
                                No accounts found under this department.
                              </TableCell>
                            </TableRow>
                          ) : (
                            roleDepartmentAccounts.map((account) => (
                              <TableRow key={account.account_id}>
                                <TableCell>{account.account_name}</TableCell>

                                {selectedNonAdminRoles.map((role) => {
                                  const accountId = Number(account.account_id);
                                  const roleId = Number(role.role_id);

                                  return (
                                    <TableCell key={roleId}>
                                      <input
                                        type="checkbox"
                                        checked={
                                          accountRolePrefs[accountId]?.[
                                            roleId
                                          ] || false
                                        }
                                        onChange={(event) => {
                                          const checked = event.target.checked;

                                          setAccountRolePrefs((prev) => ({
                                            ...prev,
                                            [accountId]: {
                                              ...(prev[accountId] || {}),
                                              [roleId]: checked,
                                            },
                                          }));
                                        }}
                                      />
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRoleOverrideOpen(false)}
            >
              Cancel
            </Button>

            <Button onClick={handleSaveRoleOverride}>Save Changes</Button>
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
      {/* Confirm Deactivate Employee Assignment Dialog */}
      <Dialog
        open={assignmentDeactivatePreview !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAssignmentToDeactivate(null);
            setAssignmentDeactivatePreview(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Employee Assignment</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this employee assignment?
              Related active workflow records will be cleaned up, but finalized
              history will be preserved.
            </DialogDescription>
          </DialogHeader>

          {assignmentDeactivatePreview && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <p className="font-medium">
                  {assignmentDeactivatePreview.assignment.employee_name}
                </p>
                <p className="text-gray-600">
                  {assignmentDeactivatePreview.assignment.department_name} /{" "}
                  {assignmentDeactivatePreview.assignment.role_name}
                </p>
              </div>

              <div className="rounded-md border p-3 text-sm space-y-2">
                <p className="font-medium">Affected records</p>

                <div className="flex justify-between gap-4">
                  <span>Employee assignment deactivated</span>
                  <span className="font-medium">
                    {
                      assignmentDeactivatePreview.cleanup
                        .employee_assignment_deactivated
                    }
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Account preferences disabled</span>
                  <span className="font-medium">
                    {
                      assignmentDeactivatePreview.cleanup
                        .account_preferences_disabled
                    }
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Future schedule slots unassigned</span>
                  <span className="font-medium">
                    {
                      assignmentDeactivatePreview.cleanup
                        .future_schedule_slots_unassigned
                    }
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Coverage requests cancelled</span>
                  <span className="font-medium">
                    {
                      assignmentDeactivatePreview.cleanup
                        .coverage_requests_cancelled
                    }
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Shift applications cancelled</span>
                  <span className="font-medium">
                    {
                      assignmentDeactivatePreview.cleanup
                        .shift_applications_cancelled
                    }
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Emergency cover targets cancelled</span>
                  <span className="font-medium">
                    {
                      assignmentDeactivatePreview.cleanup
                        .emergency_cover_targets_cancelled
                    }
                  </span>
                </div>

                <div className="flex justify-between gap-4 border-t pt-2">
                  <span>Historical finalized assignments changed</span>
                  <span className="font-medium">
                    {
                      assignmentDeactivatePreview.cleanup
                        .historical_finalized_assignments_changed
                    }
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setAssignmentToDeactivate(null);
                setAssignmentDeactivatePreview(null);
              }}
            >
              No
            </Button>

            <Button
              variant="destructive"
              onClick={confirmDeactivateEmployeeAssignment}
            >
              Yes, Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Confirm Deactivate Shift Dialog */}
      <Dialog
        open={shiftToDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShiftToDeactivate(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Shift</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this shift? This shift cannot
              be deactivated if active staffing requirements use it.
            </DialogDescription>
          </DialogHeader>

          {shiftToDeactivate && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <p className="font-medium">
                  {shiftToDeactivate.account_name} —{" "}
                  {shiftToDeactivate.shift_name}
                </p>
                <p className="text-gray-600">
                  {shiftToDeactivate.department_name || "No department"} /{" "}
                  {String(shiftToDeactivate.start_time || "").slice(0, 5)} -{" "}
                  {String(shiftToDeactivate.end_time || "").slice(0, 5)}
                </p>
              </div>

              <div className="rounded-md border p-3 text-sm space-y-2">
                <p className="font-medium">Deactivation rule</p>

                <div className="flex justify-between gap-4">
                  <span>Active staffing requirements using this shift</span>
                  <span className="font-medium">Must be 0</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Historical records</span>
                  <span className="font-medium">Preserved</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShiftToDeactivate(null)}
            >
              No
            </Button>

            <Button variant="destructive" onClick={confirmDeactivateShift}>
              Yes, Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Confirm Deactivate Account / Department Dialog */}
      <Dialog
        open={accountDepartmentToDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAccountDepartmentToDeactivate(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Deactivate{" "}
              {accountDepartmentToDeactivate?.account_id !== null
                ? "Account"
                : "Department"}
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this{" "}
              {accountDepartmentToDeactivate?.account_id !== null
                ? "account"
                : "department"}
              ? Related setup data will be preserved.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAccountDepartmentToDeactivate(null)}
            >
              No
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                if (accountDepartmentToDeactivate) {
                  handleDeactivateAccountDepartment(
                    accountDepartmentToDeactivate,
                  );
                }
              }}
            >
              Yes, Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Deactivate Role Dialog */}
      <Dialog
        open={roleToDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleToDeactivate(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this role? Related setup data
              will be preserved.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleToDeactivate(null)}>
              No
            </Button>

            <Button
              variant="destructive"
              onClick={() => {
                if (roleToDeactivate) {
                  handleDeactivateRole(roleToDeactivate);
                }
              }}
            >
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
                  {globalAvailabilityShifts.map((shift) => (
                    <div
                      key={`availability-shift-${shift.shift_name}`}
                      className="grid grid-cols-8 gap-2 mt-2 text-sm"
                    >
                      {/* SHIFT LABEL */}
                      <div className="p-2 bg-gray-100 rounded">
                        <div>{shift.shift_name}</div>
                        <div className="text-xs text-gray-500">
                          {(shift.start_time || "").slice(0, 5)} -{" "}
                          {(shift.end_time || "").slice(0, 5)}
                        </div>
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
                                shift,
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
      {/* Add Shift Dialog */}
      <Dialog
        open={isAddShiftOpen}
        onOpenChange={(open) => {
          setIsAddShiftOpen(open);

          if (!open) {
            resetAddShiftForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Shift</DialogTitle>
            <DialogDescription>
              Add a shift template under an active account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Account</Label>

              <Select
                value={newShiftAccountId}
                onValueChange={setNewShiftAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>

                <SelectContent>
                  {activeShiftAccountOptions.map((account) => (
                    <SelectItem
                      key={`shift-account-${account.account_id}`}
                      value={String(account.account_id)}
                    >
                      {account.department_name} / {account.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {activeShiftAccountOptions.length === 0 && (
                <p className="text-xs text-red-500">
                  No active accounts found. Add an active account first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Shift Name</Label>

              <Input
                value={newShiftName}
                onChange={(e) => setNewShiftName(e.target.value)}
                placeholder="e.g. MORNING"
              />
            </div>

            <div className="space-y-2">
              <Label>Start-End Time</Label>

              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={newShiftStartTime}
                  onChange={(e) => setNewShiftStartTime(e.target.value)}
                />

                <span className="text-gray-500">-</span>

                <Input
                  type="time"
                  value={newShiftEndTime}
                  onChange={(e) => setNewShiftEndTime(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddShiftForm();
                setIsAddShiftOpen(false);
              }}
            >
              Cancel
            </Button>

            <Button
              onClick={handleAddShiftSubmit}
              disabled={activeShiftAccountOptions.length === 0}
            >
              Save Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Shift Templates Template Preview Dialog */}
      <Dialog
        open={isShiftTemplatesTemplatePreviewOpen}
        onOpenChange={setIsShiftTemplatesTemplatePreviewOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Shift Configuration CSV Template</DialogTitle>
            <DialogDescription>
              Your CSV must use exactly these columns. Accounts must already
              exist.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded border overflow-hidden bg-white">
            <img
              src="/shift-templates-template.png"
              alt="Shift Configuration CSV template preview"
              className="w-full h-auto"
            />
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Required columns: account_name, shift_name, start_time, end_time.
            </p>
            <p>Accepted: same shift name can exist under different accounts.</p>
            <p>
              Rejected: duplicate active shift name or overlapping shift time
              inside the same account.
            </p>
            <p>Time format: 24-hour time such as 03:00, 15:00, or 15:00:00.</p>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsShiftTemplatesTemplatePreviewOpen(false)}
            >
              Close
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
      {/* Employee Assignments Template Preview Dialog */}
      <Dialog
        open={isEmployeeAssignmentsTemplatePreviewOpen}
        onOpenChange={setIsEmployeeAssignmentsTemplatePreviewOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Employee Assignments CSV Template</DialogTitle>
            <DialogDescription>
              Your CSV must use exactly these columns. Employees, departments,
              and roles must already exist.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded border overflow-hidden bg-white">
            <img
              src="/employee-assignments-template.png"
              alt="Employee Assignments CSV template preview"
              className="w-full h-auto"
            />
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>Required columns: employee_name, department_name, role_name.</p>
            <p>
              Accepted: multiple roles in the same department with the same
              admin type.
            </p>
            <p>
              Rejected: cross-department roles or mixed admin/non-admin roles.
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setIsEmployeeAssignmentsTemplatePreviewOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Confirm Deactivate Staffing Requirement Dialog */}
      <Dialog
        open={requirementToDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRequirementToDeactivate(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Staffing Requirement</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate this staffing requirement? It
              will no longer be used for future staffing calculations.
              Historical and finalized schedule records will be preserved.
            </DialogDescription>
          </DialogHeader>

          {requirementToDeactivate && (
            <div className="space-y-4 py-2">
              <div className="rounded-md border bg-gray-50 p-3 text-sm">
                <p className="font-medium">
                  {requirementToDeactivate.account_name} —{" "}
                  {requirementToDeactivate.shift_name}
                </p>
                <p className="text-gray-600">
                  {requirementToDeactivate.role_name ||
                    requirementToDeactivate.role_key ||
                    "Role"}{" "}
                  / Required count:{" "}
                  {requirementToDeactivate.required_count ?? 0}
                </p>
              </div>

              <div className="rounded-md border p-3 text-sm space-y-2">
                <p className="font-medium">Deactivation effect</p>

                <div className="flex justify-between gap-4">
                  <span>Future staffing calculations</span>
                  <span className="font-medium">Excluded</span>
                </div>

                <div className="flex justify-between gap-4">
                  <span>Historical finalized schedules</span>
                  <span className="font-medium">Preserved</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequirementToDeactivate(null)}
            >
              No
            </Button>

            <Button
              variant="destructive"
              onClick={confirmDeactivateRequirement}
            >
              Yes, Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Add Staffing Requirement Dialog */}
      <Dialog
        open={isAddRequirementOpen}
        onOpenChange={(open) => {
          setIsAddRequirementOpen(open);

          if (!open) {
            resetAddRequirementForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Staffing Requirement</DialogTitle>
            <DialogDescription>
              Create or update the required count for one account, shift, and
              role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Department / Account</Label>
              <Select
                value={newRequirementAccountId}
                onValueChange={(value) => {
                  setNewRequirementAccountId(value);
                  setNewRequirementShiftTemplateId("");
                  setNewRequirementRoleId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department / account" />
                </SelectTrigger>

                <SelectContent>
                  {activeShiftAccountOptions.map((row) => (
                    <SelectItem
                      key={`requirement-account-${row.account_id}`}
                      value={String(row.account_id)}
                    >
                      {row.department_name} — {row.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Shift</Label>
              <Select
                value={newRequirementShiftTemplateId}
                onValueChange={setNewRequirementShiftTemplateId}
                disabled={!newRequirementAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>

                <SelectContent>
                  {activeRequirementShiftOptions.map((shift) => (
                    <SelectItem
                      key={`requirement-shift-${shift.shift_template_id}`}
                      value={String(shift.shift_template_id)}
                    >
                      {shift.shift_name}{" "}
                      {shift.start_time && shift.end_time
                        ? `(${String(shift.start_time).slice(0, 5)} - ${String(
                            shift.end_time,
                          ).slice(0, 5)})`
                        : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={newRequirementRoleId}
                onValueChange={setNewRequirementRoleId}
                disabled={!newRequirementAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>

                <SelectContent>
                  {activeRequirementRoleOptions.map((role) => (
                    <SelectItem
                      key={`requirement-role-${role.role_id}`}
                      value={String(role.role_id)}
                    >
                      {role.role_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Required Count</Label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 2"
                value={newRequirementRequiredCount}
                onChange={(e) => setNewRequirementRequiredCount(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddRequirementForm();
                setIsAddRequirementOpen(false);
              }}
            >
              Cancel
            </Button>

            <Button onClick={handleAddRequirementSubmit}>
              Save Requirement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Staffing Requirements Template Preview Dialog */}
      <Dialog
        open={isStaffingRequirementsTemplatePreviewOpen}
        onOpenChange={setIsStaffingRequirementsTemplatePreviewOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Staffing Requirements CSV Template</DialogTitle>
            <DialogDescription>
              Your CSV must use exactly these columns. Accounts, shifts, and
              roles must already exist.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded border overflow-hidden bg-white">
            <img
              src="/staff-requirements-template.png"
              alt="Staffing Requirements CSV template preview"
              className="w-full h-auto"
            />
          </div>

          <div className="text-sm text-gray-600 space-y-1">
            <p>
              Required columns: account_name, shift_name, role_name,
              required_count.
            </p>
            <p>
              Accepted: new requirements, required count updates, and inactive
              requirements reactivated as active.
            </p>
            <p>
              Rejected: missing account, missing shift under account, missing
              role under account department, duplicate rows, or invalid
              required_count.
            </p>
          </div>

          <DialogFooter>
            <Button
              onClick={() =>
                setIsStaffingRequirementsTemplatePreviewOpen(false)
              }
            >
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
      {/* Add Employee Assignment Dialog */}
      <Dialog
        open={isAddAssignmentOpen}
        onOpenChange={(open) => {
          setIsAddAssignmentOpen(open);

          if (!open) {
            resetAddAssignmentForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee Assignment</DialogTitle>
            <DialogDescription>
              Assign an existing active employee to an active department and
              role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select
                value={newAssignmentEmployeeId}
                onValueChange={setNewAssignmentEmployeeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>

                <SelectContent>
                  {[...employees]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((employee) => (
                      <SelectItem key={employee.id} value={String(employee.id)}>
                        {employee.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={newAssignmentDepartmentName}
                onValueChange={(value) => {
                  setNewAssignmentDepartmentName(value);
                  setNewAssignmentRoleName("");
                }}
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
              <Label>Role</Label>
              <Select
                value={newAssignmentRoleName}
                onValueChange={setNewAssignmentRoleName}
                disabled={!newAssignmentDepartmentName}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      newAssignmentDepartmentName
                        ? "Select role"
                        : "Select department first"
                    }
                  />
                </SelectTrigger>

                <SelectContent>
                  {activeAssignmentRoleOptions.length === 0 ? (
                    <SelectItem value="__no_roles_found__" disabled>
                      No roles found
                    </SelectItem>
                  ) : (
                    activeAssignmentRoleOptions.map((role) => (
                      <SelectItem
                        key={
                          role.staffing_role_id ??
                          role.role_id ??
                          role.role_name
                        }
                        value={role.role_name}
                      >
                        {role.role_name}
                        {role.is_admin ? " — Admin" : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetAddAssignmentForm();
                setIsAddAssignmentOpen(false);
              }}
            >
              Cancel
            </Button>

            <Button onClick={handleAddAssignmentSubmit}>Add Assignment</Button>
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
