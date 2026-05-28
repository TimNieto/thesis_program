// src/app/components/company-settings.tsx

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { Separator } from "@/app/components/ui/separator";
import {
  Building2,
  Clock,
  Users,
  Settings as SettingsIcon,
  Bell,
  Plus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { toast } from "sonner";

interface StaffingRole {
  staffing_role_id: number;
  role_name: string;
  role_key: string;
  is_active?: boolean;
  isNew?: boolean;
}

interface StaffingRequirement {
  requirement_id?: number;
  shift_template_id: number;
  shift_name: string;
  staffing_role_id: number;
  role_name: string;
  role_key: string;
  required_count: number;
}

interface CompanySettingsProps {
  currentUser: {
    id: number;
    name: string;
    email: string;
    role: string;
    displayRole: string;
  };
}

export function CompanySettings({ currentUser }: CompanySettingsProps) {
  // Company Profile
  const [companyType, setCompanyType] = useState("Live Selling");
  const [companyName, setCompanyName] = useState("Live Stream Operations");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [branchCount] = useState("0");

  // Scheduling Rules
  const [shiftsPerDay, setShiftsPerDay] = useState("4");
  const [maxShiftsPerEmployee, setMaxShiftsPerEmployee] = useState("5");
  const [maxAbsencePerEmployee, setMaxAbsencePerEmployee] = useState("3");
  const [maxConsecutiveWorkingDays, setMaxConsecutiveWorkingDays] =
    useState("6");
  const [minRestPeriod, setMinRestPeriod] = useState("8");
  const [doubleShiftAllowance, setDoubleShiftAllowance] = useState(true);

  // Shift Timings
  const [shiftTimings, setShiftTimings] = useState<any[]>([]);
  const [pendingNewShifts, setPendingNewShifts] = useState<any[]>([]);
  const [pendingDeletedShiftIds, setPendingDeletedShiftIds] = useState<
    number[]
  >([]);
  const [isAddShiftDialogOpen, setIsAddShiftDialogOpen] = useState(false);
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftStartTime, setNewShiftStartTime] = useState("09:00");
  const [newShiftEndTime, setNewShiftEndTime] = useState("17:00");

  // Staffing Requirements
  const [staffingRoles, setStaffingRoles] = useState<StaffingRole[]>([]);
  const [staffingRequirements, setStaffingRequirements] = useState<
    StaffingRequirement[]
  >([]);
  const [pendingDeletedRoleIds, setPendingDeletedRoleIds] = useState<number[]>(
    [],
  );
  const [newRoleName, setNewRoleName] = useState("");

  // Scheduling Behavior
  const [absenceReplacementMode, setAbsenceReplacementMode] =
    useState("Automatic");

  // Notification Preferences
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const [fairnessWeight, setFairnessWeight] = useState("3");

  const [gyPenalty, setGyPenalty] = useState("5");
  const [accountPolicies, setAccountPolicies] = useState<any[]>([]);

  const [creatingAccount, setCreatingAccount] = useState(false);

  const [deletingAccount, setDeletingAccount] = useState(false);

  const [newAccountName, setNewAccountName] = useState("");

  const [newPriorityLevel, setNewPriorityLevel] = useState("2");

  const [newRequireHost, setNewRequireHost] = useState(true);

  const [newRequireOperator, setNewRequireOperator] = useState(true);

  const [newAllowPartial, setNewAllowPartial] = useState(false);

  const [newOperatorPolicy, setNewOperatorPolicy] = useState("required");

  const [selectedDeleteAccount, setSelectedDeleteAccount] = useState("");

  const [savingChanges, setSavingChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchAccountSettings();
    fetchAccounts();
    fetchShiftTemplates();
    fetchStaffingRequirements();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/settings",
      );

      const data = await res.json();

      setCompanyName(data.company_name);
      setCompanyType(data.company_type);

      setMaxConsecutiveWorkingDays(String(data.max_working_days));

      setMaxShiftsPerEmployee(String(data.max_shifts_per_week));

      setShiftsPerDay(String(data.max_shifts_per_day));

      setDoubleShiftAllowance(data.allow_double_shifts);

      setAbsenceReplacementMode(data.absence_replacement_mode);

      setFairnessWeight(String(data.fairness_weight));

      setGyPenalty(String(data.gy_shift_penalty));

      setInAppNotifications(data.enable_in_app_notifications);

    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const fetchAccountSettings = async () => {
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/account-settings",
      );

      const data = await res.json();

      setAccountPolicies(data);
    } catch (err) {
      console.error("Failed to fetch account settings", err);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/accounts",
      );

      const data = await res.json();

      setAccounts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchShiftTemplates = async () => {
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/shift-templates",
      );

      const data = await res.json();

      setShiftTimings(data);
    } catch (err) {
      console.error("Failed to load shift templates", err);
    }
  };

  const fetchStaffingRequirements = async () => {
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/staffing-requirements",
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load staffing requirements");
      }

      setStaffingRoles(data.roles || []);
      setStaffingRequirements(data.requirements || []);
    } catch (err) {
      console.error("Failed to load staffing requirements", err);
      toast.error("Failed to load staffing requirements");
    }
  };

  const createAccount = async () => {
    if (!newAccountName.trim()) {
      toast.error("Account name required");
      return;
    }
    const confirmed = window.confirm(
      `Are you sure you want to create account "${newAccountName}"?`,
    );

    if (!confirmed) {
      return;
    }
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/accounts",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            account_name: newAccountName,

            priority_level: Number(newPriorityLevel),

            require_host: newRequireHost,

            require_operator: newRequireOperator,

            allow_partial_staffing: newAllowPartial,

            operator_policy: newOperatorPolicy,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail);
      }

      toast.success("Account created");

      setCreatingAccount(false);

      setNewAccountName("");
      setNewPriorityLevel("2");
      setNewRequireHost(true);
      setNewRequireOperator(true);
      setNewAllowPartial(false);
      setNewOperatorPolicy("required");
      fetchAccounts();
      fetchAccountSettings();
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    }
  };

  const removeAccount = async () => {
    if (!selectedDeleteAccount) {
      toast.error("Select account");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove ${selectedDeleteAccount}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/accounts/${encodeURIComponent(selectedDeleteAccount)}`,
        {
          method: "DELETE",
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail);
      }

      toast.success("Account removed");

      setDeletingAccount(false);

      setSelectedDeleteAccount("");

      fetchAccounts();
      fetchAccountSettings();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove account");
    }
  };

  const getShiftId = (shift: any) =>
    Number(
      shift.shift_template_id !== undefined
        ? shift.shift_template_id
        : shift.shift_id,
    );

  const timeToMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const buildTimeRanges = (start: string, end: string) => {
    const s = timeToMinutes(start);
    const e = timeToMinutes(end);

    // Normal same-day shift
    if (e > s) {
      return [[s, e]];
    }

    // Overnight shift, split into two ranges
    return [
      [s, 1440],
      [0, e],
    ];
  };

  const doesOverlap = (
    start1: string,
    end1: string,
    start2: string,
    end2: string,
  ) => {
    const ranges1 = buildTimeRanges(start1, end1);
    const ranges2 = buildTimeRanges(start2, end2);

    for (const [s1, e1] of ranges1) {
      for (const [s2, e2] of ranges2) {
        if (Math.max(s1, s2) < Math.min(e1, e2)) {
          return true;
        }
      }
    }

    return false;
  };

  const handleAddShift = () => {
    if (!newShiftName.trim()) {
      toast.error("Shift name required");
      return;
    }

    if (!newShiftStartTime || !newShiftEndTime) {
      toast.error("Start and end time required");
      return;
    }

    if (newShiftStartTime === newShiftEndTime) {
      toast.error("Start and end time cannot be identical");
      return;
    }

    const duplicateName = shiftTimings.some(
      (shift) =>
        shift.shift_name.toLowerCase() === newShiftName.trim().toLowerCase(),
    );

    if (duplicateName) {
      toast.error("Shift already exists");
      return;
    }

    const overlappingShift = shiftTimings.find((shift) =>
      doesOverlap(
        newShiftStartTime,
        newShiftEndTime,
        shift.start_time,
        shift.end_time,
      ),
    );

    if (overlappingShift) {
      toast.error(`Overlaps with ${overlappingShift.shift_name}`);
      return;
    }
    const tempId = -Date.now();

    const newShift = {
      shift_template_id: tempId,
      shift_name: newShiftName.trim().toUpperCase(),
      start_time:
        newShiftStartTime.length === 5
          ? `${newShiftStartTime}:00`
          : newShiftStartTime,
      end_time:
        newShiftEndTime.length === 5
          ? `${newShiftEndTime}:00`
          : newShiftEndTime,
      isNew: true,
    };

    setShiftTimings((prev) => [...prev, newShift]);
    setStaffingRequirements((prev) => [
      ...prev,
      ...staffingRoles.map((role) => ({
        shift_template_id: tempId,
        shift_name: newShift.shift_name,
        staffing_role_id: role.staffing_role_id,
        role_name: role.role_name,
        role_key: role.role_key,
        required_count: 1,
      })),
    ]);
    setPendingNewShifts((prev) => [...prev, newShift]);

    setIsAddShiftDialogOpen(false);
    setNewShiftName("");
    setNewShiftStartTime("09:00");
    setNewShiftEndTime("17:00");

    toast.success("Shift added. Click Save Changes to apply.");
  };

  const handleRemoveShift = (id: number) => {
    const shiftToDelete = shiftTimings.find(
      (shift) => getShiftId(shift) === id,
    );

    if (!shiftToDelete) {
      toast.error("Shift not found");
      return;
    }

    const shiftName = shiftToDelete.shift_name || "Unnamed Shift";

    const confirmed = window.confirm(
      `Are you sure you want to remove shift "${shiftName}"?\n\nThis change will only be applied after clicking Save Changes.`,
    );

    if (!confirmed) {
      return;
    }

    setShiftTimings((prev) => prev.filter((shift) => getShiftId(shift) !== id));

    setStaffingRequirements((prev) =>
      prev.filter((req) => req.shift_template_id !== id),
    );

    if (shiftToDelete.isNew) {
      setPendingNewShifts((prev) =>
        prev.filter((shift) => getShiftId(shift) !== id),
      );
    } else {
      setPendingDeletedShiftIds((prev) =>
        prev.includes(id) ? prev : [...prev, id],
      );
    }

    toast.success("Shift removed. Click Save Changes to apply.");
  };

  const handleUpdateShift = (id: number, field: string, value: string) => {
    setShiftTimings((prev) =>
      prev.map((shift) =>
        getShiftId(shift) === id ? { ...shift, [field]: value } : shift,
      ),
    );

    setPendingNewShifts((prev) =>
      prev.map((shift) =>
        getShiftId(shift) === id ? { ...shift, [field]: value } : shift,
      ),
    );
  };

  const validateShiftTimings = () => {
    for (const shift of shiftTimings) {
      if (!shift.shift_name.trim()) {
        return "Shift name required";
      }

      if (!shift.start_time || !shift.end_time) {
        return "Start and end time required";
      }

      if (shift.start_time === shift.end_time) {
        return "Start and end time cannot be identical";
      }
    }

    for (let i = 0; i < shiftTimings.length; i++) {
      for (let j = i + 1; j < shiftTimings.length; j++) {
        const first = shiftTimings[i];
        const second = shiftTimings[j];

        if (
          first.shift_name.trim().toLowerCase() ===
          second.shift_name.trim().toLowerCase()
        ) {
          return `Duplicate shift name: ${first.shift_name}`;
        }

        if (
          doesOverlap(
            first.start_time,
            first.end_time,
            second.start_time,
            second.end_time,
          )
        ) {
          return `${first.shift_name} overlaps with ${second.shift_name}`;
        }
      }
    }

    return null;
  };

  const handleAddStaffingRole = () => {
    if (!newRoleName.trim()) {
      toast.error("Role name required");
      return;
    }

    const cleanedName = newRoleName.trim();

    const duplicate = staffingRoles.some(
      (role) => role.role_name.toLowerCase() === cleanedName.toLowerCase(),
    );

    if (duplicate) {
      toast.error("Role already exists");
      return;
    }

    const tempId = -Date.now();

    const newRole: StaffingRole = {
      staffing_role_id: tempId,
      role_name: cleanedName,
      role_key: cleanedName.toLowerCase().replace(/\s+/g, "_"),
      isNew: true,
    };

    setStaffingRoles((prev) => [...prev, newRole]);

    setStaffingRequirements((prev) => [
      ...prev,
      ...shiftTimings.map((shift) => ({
        shift_template_id: getShiftId(shift),
        shift_name: shift.shift_name,
        staffing_role_id: tempId,
        role_name: newRole.role_name,
        role_key: newRole.role_key,
        required_count: 1,
      })),
    ]);

    setNewRoleName("");

    toast.success("Role added. Click Save Changes to apply.");
  };

  const handleRemoveStaffingRole = (roleId: number) => {
    const role = staffingRoles.find((r) => r.staffing_role_id === roleId);

    if (!role) {
      toast.error("Role not found");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to remove role "${role.role_name}"?\n\nThis change will only be applied after clicking Save Changes.`,
    );

    if (!confirmed) {
      return;
    }

    setStaffingRoles((prev) =>
      prev.filter((r) => r.staffing_role_id !== roleId),
    );

    setStaffingRequirements((prev) =>
      prev.filter((req) => req.staffing_role_id !== roleId),
    );

    if (!role.isNew) {
      setPendingDeletedRoleIds((prev) =>
        prev.includes(roleId) ? prev : [...prev, roleId],
      );
    }

    toast.success("Role removed. Click Save Changes to apply.");
  };

  const updateStaffingCount = (
    shiftTemplateId: number,
    staffingRoleId: number,
    value: number,
  ) => {
    const safeValue = Math.max(0, Number(value) || 0);

    setStaffingRequirements((prev) =>
      prev.map((req) =>
        req.shift_template_id === shiftTemplateId &&
        req.staffing_role_id === staffingRoleId
          ? {
              ...req,
              required_count: safeValue,
            }
          : req,
      ),
    );
  };

  const handleSaveChanges = async () => {
    const validationError = validateShiftTimings();

    if (validationError) {
      toast.error(validationError);
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to save all company setting changes?\n\nThis will apply shift timing changes, staffing role changes, and staffing requirement changes.",
    );

    if (!confirmed) {
      return;
    }

    setSavingChanges(true);
    
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/settings",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_name: companyName,
            company_type: companyType,

            max_working_days: Number(maxConsecutiveWorkingDays),

            max_shifts_per_day: Number(shiftsPerDay),

            max_shifts_per_week: Number(maxShiftsPerEmployee),

            allow_double_shifts: doubleShiftAllowance,

            fairness_weight: Number(fairnessWeight),

            gy_shift_penalty: Number(gyPenalty),

            absence_replacement_mode: absenceReplacementMode,

            enable_in_app_notifications: inAppNotifications,

            updated_by: currentUser.id,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to save settings");
      }

      // 1. DELETE shifts marked for removal
      for (const shiftId of pendingDeletedShiftIds) {
        const res = await fetch(
          `https://backend-production-6e75.up.railway.app/shift-templates/${shiftId}`,
          {
            method: "DELETE",
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Failed to delete shift");
        }
      }
      
      const shiftIdMap: Record<number, number> = {};

      // 2. CREATE or RESTORE newly added shifts
      for (const shift of pendingNewShifts) {
        const res = await fetch(
          "https://backend-production-6e75.up.railway.app/shift-templates",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              shift_name: shift.shift_name,
              start_time:
                shift.start_time.length === 5
                  ? `${shift.start_time}:00`
                  : shift.start_time,
              end_time:
                shift.end_time.length === 5
                  ? `${shift.end_time}:00`
                  : shift.end_time,
            }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Failed to create shift");
        }

        const savedShiftId = Number(data.shift_template_id);

        if (savedShiftId) {
          shiftIdMap[getShiftId(shift)] = savedShiftId;
        }
      }

      // 3. UPDATE existing shifts that remain active
      const existingShifts = shiftTimings.filter(
        (shift) =>
          !shift.isNew && !pendingDeletedShiftIds.includes(getShiftId(shift)),
      );

      for (const shift of existingShifts) {
        const shiftId = getShiftId(shift);

        if (!shiftId) {
          continue;
        }

        const res = await fetch(
          `https://backend-production-6e75.up.railway.app/shift-templates/${shiftId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              shift_name: shift.shift_name,
              start_time:
                shift.start_time.length === 5
                  ? `${shift.start_time}:00`
                  : shift.start_time,
              end_time:
                shift.end_time.length === 5
                  ? `${shift.end_time}:00`
                  : shift.end_time,
            }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Failed to update shift");
        }
      }

      // 4. CREATE or REACTIVATE newly added staffing roles
      const newStaffingRoles = staffingRoles.filter((role) => role.isNew);

      for (const role of newStaffingRoles) {
        const res = await fetch(
          "https://backend-production-6e75.up.railway.app/staffing-roles",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              role_name: role.role_name,
            }),
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Failed to save staffing role");
        }
      }

      // 5. DELETE staffing roles marked for removal
      for (const roleId of pendingDeletedRoleIds) {
        const res = await fetch(
          `https://backend-production-6e75.up.railway.app/staffing-roles/${roleId}`,
          {
            method: "DELETE",
          },
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.detail || "Failed to delete staffing role");
        }
      }

      // 6. RELOAD staffing roles after creates/deletes
      const staffingReloadRes = await fetch(
        "https://backend-production-6e75.up.railway.app/staffing-requirements",
      );

      const staffingReloadData = await staffingReloadRes.json();

      if (!staffingReloadRes.ok) {
        throw new Error(
          staffingReloadData.detail || "Failed to reload staffing requirements",
        );
      }

      const savedRoles = staffingReloadData.roles || [];

      const roleIdMap: Record<number, number> = {};

      staffingRoles.forEach((localRole) => {
        const savedRole = savedRoles.find(
          (role: any) =>
            role.role_key === localRole.role_key ||
            role.role_name.toLowerCase() === localRole.role_name.toLowerCase(),
        );

        if (savedRole) {
          roleIdMap[localRole.staffing_role_id] = savedRole.staffing_role_id;
        }
      });

      // 7. SAVE staffing requirement counts for all active roles
      const requirementsToSave = staffingRequirements
        .filter((req) => !pendingDeletedRoleIds.includes(req.staffing_role_id))
        .map((req) => ({
          shift_template_id:
            shiftIdMap[req.shift_template_id] || req.shift_template_id,
          staffing_role_id:
            roleIdMap[req.staffing_role_id] || req.staffing_role_id,
          required_count: req.required_count,
        }))
        .filter(
          (req) =>
            req.shift_template_id > 0 &&
            req.staffing_role_id > 0,
        );

      const staffingRes = await fetch(
        "https://backend-production-6e75.up.railway.app/staffing-requirements",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requirements: requirementsToSave,
          }),
        },
      );

      const staffingData = await staffingRes.json();

      if (!staffingRes.ok) {
        throw new Error(
          staffingData.detail || "Failed to save staffing requirements",
        );
      }

      await fetchShiftTemplates();
      await fetchStaffingRequirements();

      setPendingNewShifts([]);
      setPendingDeletedShiftIds([]);
      setPendingDeletedRoleIds([]);
      setNewRoleName("");

      toast.success("Company settings saved successfully");

    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSavingChanges(false);
    }
  };

  const saveAccountPolicies = async () => {
    try {
      for (const policy of accountPolicies) {
        await fetch(
          `https://backend-production-6e75.up.railway.app/account-settings/${policy.account_setting_id}`,
          {
            method: "PUT",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              priority_level: policy.priority_level,

              require_host: policy.require_host,

              require_operator: policy.require_operator,

              operator_policy: policy.operator_policy,

              allow_partial_staffing: policy.allow_partial_staffing,
            }),
          },
        );
      }

      toast.success("Account policies saved");
    } catch (err) {
      console.error(err);

      toast.error("Failed to save account policies");
    }
  };

  const handleCancel = async () => {
    await fetchSettings();
    await fetchAccountSettings();
    await fetchAccounts();
    await fetchShiftTemplates();
    await fetchStaffingRequirements();

    setPendingNewShifts([]);
    setPendingDeletedShiftIds([]);
    setPendingDeletedRoleIds([]);
    setNewRoleName("");

    setIsAddShiftDialogOpen(false);
    setNewShiftName("");
    setNewShiftStartTime("09:00");
    setNewShiftEndTime("17:00");

    toast.info("Changes discarded");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-3xl">Company Settings</h2>
        <p className="text-gray-600">
          Configure scheduling rules, shifts, and notification preferences
        </p>
      </div>

      {/* Company Profile Settings */}
      {creatingAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Create Account</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Account Name</Label>

              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Priority Level</Label>

              <Select
                value={newPriorityLevel}
                onValueChange={setNewPriorityLevel}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="1">High</SelectItem>

                  <SelectItem value="2">Medium</SelectItem>

                  <SelectItem value="3">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Require Host</Label>

              <Switch
                checked={newRequireHost}
                onCheckedChange={setNewRequireHost}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Require Operator</Label>

              <Switch
                checked={newRequireOperator}
                onCheckedChange={setNewRequireOperator}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Allow Partial Staffing</Label>

              <Switch
                checked={newAllowPartial}
                onCheckedChange={setNewAllowPartial}
              />
            </div>

            <div className="space-y-2">
              <Label>Operator Policy</Label>

              <Select
                value={newOperatorPolicy}
                onValueChange={setNewOperatorPolicy}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="required">Required</SelectItem>

                  <SelectItem value="optional">Optional</SelectItem>

                  <SelectItem value="avoid">Avoid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button onClick={createAccount}>Confirm Add</Button>

              <Button
                variant="outline"
                onClick={() => setCreatingAccount(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {deletingAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Remove Account</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Select
              value={selectedDeleteAccount}
              onValueChange={setSelectedDeleteAccount}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>

              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.name} value={account.name}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button variant="destructive" onClick={removeAccount}>
                Confirm Remove
              </Button>

              <Button
                variant="outline"
                onClick={() => setDeletingAccount(false)}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Dialog
        open={isAddShiftDialogOpen}
        onOpenChange={setIsAddShiftDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Shift Template</DialogTitle>
            <DialogDescription>
              Add a new shift or restore a previously deleted shift using the
              same name.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newShiftName">Shift Name</Label>
              <Input
                id="newShiftName"
                value={newShiftName}
                onChange={(e) => setNewShiftName(e.target.value)}
                placeholder="e.g., AM, PM, GY"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newShiftStartTime">Start Time</Label>
              <Input
                id="newShiftStartTime"
                type="time"
                value={newShiftStartTime}
                onChange={(e) => setNewShiftStartTime(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newShiftEndTime">End Time</Label>
              <Input
                id="newShiftEndTime"
                type="time"
                value={newShiftEndTime}
                onChange={(e) => setNewShiftEndTime(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddShiftDialogOpen(false)}
            >
              Cancel
            </Button>

            <Button onClick={handleAddShift}>Save Shift</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-blue-600" />
            <CardTitle>Company Profile</CardTitle>
          </div>
          <CardDescription>
            Basic information about your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="companyType">Company Type</Label>
              <Select value={companyType} onValueChange={setCompanyType}>
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

            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Enter company name"
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountCount">Account Count</Label>

                <Input
                  id="accountCount"
                  value={accounts.length}
                  disabled
                  className="bg-gray-50 cursor-not-allowed"
                />

                <p className="text-xs text-gray-500">
                  Automatically based on existing accounts
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    if (deletingAccount) {
                      toast.error("Finish remove operation first");

                      return;
                    }

                    setCreatingAccount(true);
                  }}
                >
                  + Add Account
                </Button>

                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (creatingAccount) {
                      toast.error("Finish add operation first");

                      return;
                    }

                    setDeletingAccount(true);
                  }}
                >
                  Remove Account
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="branchCount">Branch / Department Count</Label>

              <Input
                id="branchCount"
                value={branchCount}
                disabled
                className="bg-gray-50 cursor-not-allowed"
              />

              <p className="text-xs text-gray-500">Currently not applicable</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scheduling Rules */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-blue-600" />
            <CardTitle>Scheduling Rules</CardTitle>
          </div>
          <CardDescription>
            Define constraints and limits for employee scheduling
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="shiftsPerDay">Shifts Count per Day</Label>
              <Select value={shiftsPerDay} onValueChange={setShiftsPerDay}>
                <SelectTrigger id="shiftsPerDay">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Shift</SelectItem>
                  <SelectItem value="2">2 Shifts</SelectItem>
                  <SelectItem value="3">3 Shifts</SelectItem>
                  <SelectItem value="4">4 Shifts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxShifts">Max Shifts per Employee</Label>
              <Input
                id="maxShifts"
                type="number"
                value={maxShiftsPerEmployee}
                onChange={(e) => setMaxShiftsPerEmployee(e.target.value)}
                placeholder="Enter max shifts"
              />
              <p className="text-xs text-gray-500">Maximum shifts per week</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxAbsence">Max Absence per Employee</Label>
              <Input
                id="maxAbsence"
                type="number"
                value={maxAbsencePerEmployee}
                onChange={(e) => setMaxAbsencePerEmployee(e.target.value)}
                placeholder="Enter max absences"
              />
              <p className="text-xs text-gray-500">
                Maximum absences per month
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxConsecutive">
                Max Consecutive Working Days
              </Label>
              <Input
                id="maxConsecutive"
                type="number"
                value={maxConsecutiveWorkingDays}
                onChange={(e) => setMaxConsecutiveWorkingDays(e.target.value)}
                placeholder="Enter max days"
              />
              <p className="text-xs text-gray-500">Before mandatory rest day</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="minRest">
                Minimum Rest Period Between Shifts
              </Label>
              <Input
                id="minRest"
                type="number"
                value={minRestPeriod}
                onChange={(e) => setMinRestPeriod(e.target.value)}
                placeholder="Hours"
              />
              <p className="text-xs text-gray-500">In hours</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between pt-6">
                <div className="space-y-0.5">
                  <Label htmlFor="doubleShift">Double Shift Allowance</Label>
                  <p className="text-xs text-gray-500">
                    Allow employees to work consecutive shifts
                  </p>
                </div>
                <Switch
                  id="doubleShift"
                  checked={doubleShiftAllowance}
                  onCheckedChange={setDoubleShiftAllowance}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shift Timing Configuration */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="size-5 text-blue-600" />
                <CardTitle>Shift Timing Configuration</CardTitle>
              </div>
              <CardDescription>
                Define shift schedules and operating hours
              </CardDescription>
            </div>
            <Button
              onClick={() => setIsAddShiftDialogOpen(true)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="size-4" />
              Add Shift
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {shiftTimings.map((shift, index) => (
              <div key={String(getShiftId(shift))}>
                {index > 0 && <Separator className="my-4" />}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`shiftName-${String(getShiftId(shift))}`}>
                      Shift Name
                    </Label>
                    <Input
                      id={`shiftName-${String(getShiftId(shift))}`}
                      value={shift.shift_name}
                      onChange={(e) =>
                        handleUpdateShift(
                          getShiftId(shift),
                          "shift_name",
                          e.target.value,
                        )
                      }
                      placeholder="e.g., AM, PM, GY"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`startTime-${String(getShiftId(shift))}`}>
                      Start Time
                    </Label>

                    <Input
                      id={`startTime-${String(getShiftId(shift))}`}
                      type="time"
                      value={shift.start_time?.slice(0, 5) || ""}
                      onChange={(e) =>
                        handleUpdateShift(
                          getShiftId(shift),
                          "start_time",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`endTime-${String(getShiftId(shift))}`}>
                      End Time
                    </Label>
                    <Input
                      id={`endTime-${String(getShiftId(shift))}`}
                      type="time"
                      value={shift.end_time?.slice(0, 5) || ""}
                      onChange={(e) =>
                        handleUpdateShift(
                          getShiftId(shift),
                          "end_time",
                          e.target.value,
                        )
                      }
                    />
                  </div>
                  {shiftTimings.length > 1 && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveShift(getShiftId(shift))}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Staffing Requirements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            Staffing Requirements
          </CardTitle>
          <CardDescription>
            Configure required roles per shift. Changes apply only after Save
            Changes.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New role name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
            />

            <Button onClick={handleAddStaffingRole} className="gap-2">
              <Plus className="size-4" />
              Add Role
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border text-sm">
              <thead>
                <tr>
                  <th className="border p-2 text-left">Shift</th>

                  {staffingRoles.map((role) => (
                    <th key={role.staffing_role_id} className="border p-2">
                      <div className="flex items-center justify-center gap-2">
                        <span>{role.role_name}</span>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            handleRemoveStaffingRole(role.staffing_role_id)
                          }
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {shiftTimings.map((shift) => {
                  const shiftId = getShiftId(shift);

                  return (
                    <tr key={shiftId}>
                      <td className="border p-2 font-medium">
                        {shift.shift_name}
                      </td>

                      {staffingRoles.map((role) => {
                        const requirement = staffingRequirements.find(
                          (req) =>
                            req.shift_template_id === shiftId &&
                            req.staffing_role_id === role.staffing_role_id,
                        );

                        return (
                          <td
                            key={role.staffing_role_id}
                            className="border p-2"
                          >
                            <Input
                              type="number"
                              min="0"
                              value={requirement?.required_count ?? 0}
                              onChange={(e) =>
                                updateStaffingCount(
                                  shiftId,
                                  role.staffing_role_id,
                                  Number(e.target.value),
                                )
                              }
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {staffingRoles.length === 0 && (
            <p className="text-sm text-gray-500">
              No active staffing roles. Schedule generation will produce no role
              assignments until roles are added.
            </p>
          )}
        </CardContent>
      </Card>
      {/* Scheduler Scoring */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-blue-600" />
            <CardTitle>Scheduler Scoring</CardTitle>
          </div>

          <CardDescription>
            Configure assignment balancing and night shift weighting
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Fairness Weight */}
          <div className="space-y-2">
            <Label>Fairness Weight</Label>

            <Select value={fairnessWeight} onValueChange={setFairnessWeight}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="1">1 - Loose Balancing</SelectItem>

                <SelectItem value="2">2 - Mild Balancing</SelectItem>

                <SelectItem value="3">3 - Normal Balancing</SelectItem>

                <SelectItem value="4">4 - Strong Balancing</SelectItem>

                <SelectItem value="5">5 - Very Strict Balancing</SelectItem>
              </SelectContent>
            </Select>

            <p className="text-xs text-gray-500">
              Higher values distribute shifts more evenly
            </p>
          </div>

          {/* GY Penalty */}
          <div className="space-y-2">
            <Label>GY Shift Penalty</Label>

            <Select value={gyPenalty} onValueChange={setGyPenalty}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="0">0 - No Penalty</SelectItem>

                <SelectItem value="2">2 - Low Penalty</SelectItem>

                <SelectItem value="5">5 - Moderate Penalty</SelectItem>

                <SelectItem value="8">8 - High Penalty</SelectItem>

                <SelectItem value="10">10 - Very High Penalty</SelectItem>
              </SelectContent>
            </Select>

            <p className="text-xs text-gray-500">
              Higher values avoid assigning GY shifts
            </p>
          </div>
        </CardContent>
      </Card>
      {/* Account Scheduling Policies */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-blue-600" />

            <CardTitle>Account Scheduling Policies</CardTitle>
          </div>

          <CardDescription>
            Configure account priority and staffing requirements
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {accountPolicies.map((policy, index) => (
            <div
              key={policy.account_setting_id}
              className="border rounded-lg p-4 space-y-4"
            >
              <div className="font-semibold">{policy.account_name}</div>

              {/* Priority */}
              <div className="space-y-2">
                <Label>Priority Level</Label>

                <Select
                  value={String(policy.priority_level)}
                  onValueChange={(value) => {
                    const updated = [...accountPolicies];

                    updated[index].priority_level = Number(value);

                    setAccountPolicies(updated);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="1">High Priority</SelectItem>

                    <SelectItem value="2">Medium Priority</SelectItem>

                    <SelectItem value="3">Low Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Operator Policy */}
              <div className="space-y-2">
                <Label>Operator Policy</Label>

                <Select
                  value={policy.operator_policy}
                  onValueChange={(value) => {
                    const updated = [...accountPolicies];

                    updated[index].operator_policy = value;

                    setAccountPolicies(updated);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="required">Required</SelectItem>

                    <SelectItem value="optional">Optional</SelectItem>

                    <SelectItem value="avoid">Avoid</SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-xs text-gray-500">
                  Configure how strongly the scheduler should assign operators
                </p>
              </div>

              {/* Partial Staffing */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Allow Partial Staffing</Label>

                  <p className="text-xs text-gray-500">
                    Scheduler may leave some slots unfilled
                  </p>
                </div>

                <Switch
                  checked={policy.allow_partial_staffing}
                  onCheckedChange={(checked) => {
                    const updated = [...accountPolicies];

                    updated[index].allow_partial_staffing = checked;

                    setAccountPolicies(updated);
                  }}
                />
              </div>
            </div>
          ))}

          <Button onClick={saveAccountPolicies}>Save Account Policies</Button>
        </CardContent>
      </Card>
      {/* Scheduling Behavior */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-blue-600" />
            <CardTitle>Scheduling Behavior</CardTitle>
          </div>
          <CardDescription>
            Configure how the system handles scheduling decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="absenceMode">Absence Replacement Mode</Label>
            <Select
              value={absenceReplacementMode}
              onValueChange={setAbsenceReplacementMode}
            >
              <SelectTrigger id="absenceMode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Automatic">Automatic</SelectItem>
                <SelectItem value="Manual">Manual</SelectItem>
                <SelectItem value="Hybrid">Hybrid</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {absenceReplacementMode === "Automatic" &&
                "System automatically assigns replacements when someone is absent"}
              {absenceReplacementMode === "Manual" &&
                "Admin must manually approve all replacement assignments"}
              {absenceReplacementMode === "Hybrid" &&
                "System suggests replacements but requires admin approval"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-blue-600" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Choose how you receive system notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inAppNotif">In-app Notifications</Label>
              <p className="text-xs text-gray-500">
                Receive notifications within the application
              </p>
            </div>
            <Switch
              id="inAppNotif"
              checked={inAppNotifications}
              onCheckedChange={setInAppNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotif">Email Notifications</Label>
              <p className="text-xs text-gray-500">
                Receive notifications via email
              </p>
            </div>
            <Switch
              id="emailNotif"
              checked={emailNotifications}
              onCheckedChange={setEmailNotifications}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="smsNotif">SMS Notifications</Label>
              <p className="text-xs text-gray-500">
                Receive notifications via text message
              </p>
            </div>
            <Switch
              id="smsNotif"
              checked={smsNotifications}
              onCheckedChange={setSmsNotifications}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSaveChanges} disabled={savingChanges}>
            {savingChanges ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
