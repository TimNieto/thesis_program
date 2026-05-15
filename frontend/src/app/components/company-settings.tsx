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
import { toast } from "sonner";

interface CustomRole {
  id: string;
  roleName: string;
  requiredCount: number;
}

export function CompanySettings() {
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

  // Staffing Requirements
  const [requiredHosts, setRequiredHosts] = useState("1");
  const [requiredOperators, setRequiredOperators] = useState("1");
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

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

  useEffect(() => {
    fetchSettings();
    fetchAccountSettings();
    fetchAccounts();
    fetchShiftTemplates();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(
        "https://thesisprogram-production.up.railway.app/settings",
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
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const fetchAccountSettings = async () => {
    try {
      const res = await fetch(
        "https://thesisprogram-production.up.railway.app/account-settings",
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
        "https://thesisprogram-production.up.railway.app/accounts",
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
        "https://thesisprogram-production.up.railway.app/shift-templates"
      );

      const data = await res.json();

      setShiftTimings(data);
    } catch (err) {
      console.error("Failed to load shift templates", err);
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
        "https://thesisprogram-production.up.railway.app/accounts",
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
        `https://thesisprogram-production.up.railway.app/accounts/${encodeURIComponent(selectedDeleteAccount)}`,
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
        : shift.shift_id
    );
  
  const handleAddShift = async () => {
    try {

      const response = await fetch(
        "https://thesisprogram-production.up.railway.app/shift-templates",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            shift_name: "NEW_SHIFT",
            start_time: "09:00:00",
            end_time: "17:00:00",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to create shift"
        );
      }

      // IMPORTANT:
      // reload from backend
      await fetchShiftTemplates();

      toast.success("Shift template created");

    } catch (err: any) {

      console.error(err);

      toast.error(
        err.message || "Failed to create shift"
      );
    }
  };

  const handleRemoveShift = async (id: number) => {

    const shiftToDelete = shiftTimings.find(
      (shift) => getShiftId(shift) === id
    );

    if (!shiftToDelete) {
      toast.error("Shift not found");
      return;
    }

    const shiftName =
      shiftToDelete.shift_name || "Unnamed Shift";

    const confirmed = window.confirm(
      `Are you sure you want to delete shift "${shiftName}"?\n\nThis will deactivate the shift template but preserve historical schedules.`
    );

    if (!confirmed) {
      return;
    }

    try {

      // -----------------------------
      // DETERMINE IF SHIFT EXISTS IN DB
      // -----------------------------
      const isPersisted =
        shiftToDelete.shift_template_id !== undefined;

      // -----------------------------
      // DATABASE DELETE
      // -----------------------------
      if (isPersisted) {

        const response = await fetch(
          `https://thesisprogram-production.up.railway.app/shift-templates/${id}`,
          {
            method: "DELETE",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.detail || "Failed to delete shift"
          );
        }
      }

      // -----------------------------
      // REMOVE FROM FRONTEND STATE
      // -----------------------------
      setShiftTimings((prev) =>
        prev.filter(
          (shift) =>
            getShiftId(shift) !== id
        )
      );

      toast.success(
        `Shift "${shiftName}" deleted`
      );

    } catch (err: any) {

      console.error(err);

      toast.error(
        err.message || "Failed to remove shift"
      );
    }
  };

  const handleUpdateShift = (
    id: number,
    field: string,
    value: string,
  ) => {
    setShiftTimings((prev) =>
      prev.map((shift) =>
        getShiftId(shift) === id
          ? { ...shift, [field]: value }
          : shift,
      ),
    );
  };

  const handleAddRole = () => {
    const newRole: CustomRole = {
      id: Date.now().toString(),
      roleName: "",
      requiredCount: 1,
    };
    setCustomRoles([...customRoles, newRole]);
  };

  const handleRemoveRole = (id: string) => {
    setCustomRoles(customRoles.filter((role) => role.id !== id));
  };

  const handleUpdateRole = (
    id: string,
    field: keyof CustomRole,
    value: string | number,
  ) => {
    setCustomRoles(
      customRoles.map((role) =>
        role.id === id ? { ...role, [field]: value } : role,
      ),
    );
  };

  const handleSaveChanges = async () => {
    try {
      const res = await fetch(
        "https://thesisprogram-production.up.railway.app/settings",
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
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to save settings");
      }

      for (const shift of shiftTimings) {

        const shiftId = getShiftId(shift);

        // skip invalid shifts
        if (!shiftId) {
          continue;
        }

        await fetch(
          `https://thesisprogram-production.up.railway.app/shift-templates/${shiftId}`,
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
          }
        );
      }

      toast.success("Company settings saved successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save settings");
    }
  };

  const saveAccountPolicies = async () => {
    try {
      for (const policy of accountPolicies) {
        await fetch(
          `https://thesisprogram-production.up.railway.app/account-settings/${policy.account_setting_id}`,
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

  const handleCancel = () => {
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
              onClick={handleAddShift}
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
                          e.target.value
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
                      value={shift.start_time}
                      onChange={(e) =>
                        handleUpdateShift(
                          getShiftId(shift),
                          "start_time",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`endTime-${String(getShiftId(shift))}`}>End Time</Label>
                    <Input
                      id={`endTime-${String(getShiftId(shift))}`}
                      type="time"
                      value={shift.end_time}
                      onChange={(e) =>
                        handleUpdateShift(
                          getShiftId(shift),
                          "end_time",
                          e.target.value
                        )
                      }
                    />
                  </div>
                  {shiftTimings.length > 1 && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() =>
                        handleRemoveShift(getShiftId(shift))
                      }
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
          <div className="flex items-center gap-2">
            <Users className="size-5 text-blue-600" />
            <CardTitle>Staffing Requirements</CardTitle>
          </div>
          <CardDescription>
            Define required roles and headcount per shift
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="requiredHosts">Required Hosts per Shift</Label>
              <Input
                id="requiredHosts"
                type="number"
                value={requiredHosts}
                onChange={(e) => setRequiredHosts(e.target.value)}
                placeholder="Enter count"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="requiredOperators">
                Required Operators per Shift
              </Label>
              <Input
                id="requiredOperators"
                type="number"
                value={requiredOperators}
                onChange={(e) => setRequiredOperators(e.target.value)}
                placeholder="Enter count"
              />
            </div>
          </div>

          {customRoles.length > 0 && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label>Custom Roles</Label>
                {customRoles.map((role) => (
                  <div
                    key={role.id}
                    className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end"
                  >
                    <div className="space-y-2">
                      <Label htmlFor={`roleName-${role.id}`}>Role Name</Label>
                      <Input
                        id={`roleName-${role.id}`}
                        value={role.roleName}
                        onChange={(e) =>
                          handleUpdateRole(role.id, "roleName", e.target.value)
                        }
                        placeholder="e.g., Moderator, Tech Support"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`roleCount-${role.id}`}>
                        Required Count
                      </Label>
                      <Input
                        id={`roleCount-${role.id}`}
                        type="number"
                        value={role.requiredCount}
                        onChange={(e) =>
                          handleUpdateRole(
                            role.id,
                            "requiredCount",
                            parseInt(e.target.value) || 1,
                          )
                        }
                        placeholder="Count"
                      />
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveRole(role.id)}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}

          <Button
            onClick={handleAddRole}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Plus className="size-4" />
            Add Role
          </Button>
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
          <Button onClick={handleSaveChanges}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
