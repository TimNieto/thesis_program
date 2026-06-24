// ---------------------------------------------------
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
import { Building2, Settings as SettingsIcon, Bell } from "lucide-react";
import { toast } from "sonner";

interface CompanySettingsSectionPermissions {
  companyProfile?: boolean;
  schedulingRules?: boolean;
  schedulerScoring?: boolean;
  accountSchedulingPolicies?: boolean;
  schedulingBehavior?: boolean;
  notificationPreferences?: boolean;
}

interface CompanySettingsProps {
  currentUser: {
    id: number;
    name: string;
    email: string;
    role: string;
    displayRole: string;
    company_id: number | null;
    company_name: string | null;
  };
  sectionPermissions?: CompanySettingsSectionPermissions;
}

export function CompanySettings({
  currentUser,
  sectionPermissions,
}: CompanySettingsProps) {
  // Company Profile
  const [companyType, setCompanyType] = useState("Live Selling");
  const [companyName, setCompanyName] = useState("Live Stream Operations");

  // Scheduling Rules
  const [shiftsPerDay, setShiftsPerDay] = useState("4");
  const [maxShiftsPerEmployee, setMaxShiftsPerEmployee] = useState("5");
  const [maxAbsencePerEmployee, setMaxAbsencePerEmployee] = useState("3");
  const [maxConsecutiveWorkingDays, setMaxConsecutiveWorkingDays] =
    useState("6");
  const [minRestPeriod, setMinRestPeriod] = useState("8");
  const [doubleShiftAllowance, setDoubleShiftAllowance] = useState(true);

  // Scheduling Behavior
  const [absenceReplacementMode, setAbsenceReplacementMode] =
    useState("Automatic");

  // Notification Preferences
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(false);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const [fairnessWeight, setFairnessWeight] = useState("3");

  const [gyPenalty, setGyPenalty] = useState("20");
  const [absenceTolerance, setAbsenceTolerance] = useState("50");
  const [accountPolicies, setAccountPolicies] = useState<any[]>([]);
  const [savingChanges, setSavingChanges] = useState(false);

  const isReadOnly = currentUser.role === "super-admin";

  const canShowSection = (
    sectionKey: keyof CompanySettingsSectionPermissions,
  ) => sectionPermissions?.[sectionKey] !== false;

  useEffect(() => {
    fetchSettings();
    fetchAccountSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/settings?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      setCompanyName(data.company_name);
      setCompanyType(data.company_type);

      setMaxConsecutiveWorkingDays(String(data.max_working_days));

      setMinRestPeriod(String(data.min_rest_period_hours ?? 8));

      setMaxShiftsPerEmployee(String(data.max_shifts_per_week));

      setShiftsPerDay(String(data.max_shifts_per_day));

      setDoubleShiftAllowance(data.allow_double_shifts);

      setAbsenceReplacementMode(data.absence_replacement_mode);

      setFairnessWeight(String(data.fairness_weight));

      setGyPenalty(String(data.gy_fatigue_penalty ?? 20));

      setAbsenceTolerance(String(data.absence_tolerance ?? 50));

      setInAppNotifications(data.enable_in_app_notifications);
    } catch (err) {
      console.error("Failed to fetch settings", err);
    }
  };

  const fetchAccountSettings = async () => {
    try {
      if (!currentUser.company_id) {
        setAccountPolicies([]);
        return;
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/accounts?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      if (!res.ok) {
        console.error("Failed to fetch account policies:", data);
        setAccountPolicies([]);
        return;
      }

      setAccountPolicies(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch account settings", err);
      setAccountPolicies([]);
    }
  };

  const handleSaveChanges = async () => {
    if (isReadOnly) {
      toast.info("Super admin can only view company settings");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to save all company setting changes?",
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
            company_id: currentUser.company_id,
            company_name: companyName,
            company_type: companyType,
            max_working_days: Number(maxConsecutiveWorkingDays),
            min_rest_period_hours: Number(minRestPeriod),
            max_shifts_per_day: Number(shiftsPerDay),
            max_shifts_per_week: Number(maxShiftsPerEmployee),
            allow_double_shifts: doubleShiftAllowance,
            fairness_weight: Number(fairnessWeight),
            gy_fatigue_penalty: Number(gyPenalty),
            absence_tolerance: Number(absenceTolerance),
            absence_replacement_mode: absenceReplacementMode,
            enable_in_app_notifications: inAppNotifications,
            updated_by: currentUser.id,
          }),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to save settings");
      }

      for (const policy of accountPolicies) {
        const accountId = policy.account_id ?? policy.id;

        if (!accountId) {
          continue;
        }

        const policyRes = await fetch(
          `https://backend-production-6e75.up.railway.app/accounts/${accountId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              company_id: currentUser.company_id,
              priority_level: Number(policy.priority_level),
              allow_partial_staffing: false,
            }),
          },
        );

        const policyData = await policyRes.json();

        if (!policyRes.ok) {
          throw new Error(
            policyData.detail || "Failed to save account policies",
          );
        }
      }

      toast.success("Company settings saved successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSavingChanges(false);
    }
  };

  const handleCancel = async () => {
    await fetchSettings();
    await fetchAccountSettings();

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

      {isReadOnly && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <p className="text-sm text-blue-700">
              View-only mode: Super admin can view company settings, but only
              company admin can change them.
            </p>
          </CardContent>
        </Card>
      )}

      <div className={isReadOnly ? "pointer-events-none opacity-75" : ""}>
        {/* Company Profile Settings */}
        {canShowSection("companyProfile") && (
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
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input
                    id="companyName"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Enter company name"
                  />
                </div>

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
                      <SelectItem value="Manufacturing">
                        Manufacturing
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Scheduling Rules */}
        {canShowSection("schedulingRules") && (
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
                  <p className="text-xs text-gray-500">
                    Maximum shifts per week
                  </p>
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
                    onChange={(e) =>
                      setMaxConsecutiveWorkingDays(e.target.value)
                    }
                    placeholder="Enter max days"
                  />
                  <p className="text-xs text-gray-500">
                    Before mandatory rest day
                  </p>
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
                      <Label htmlFor="doubleShift">
                        Double Shift Allowance
                      </Label>
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
        )}
        {/* Scheduler Scoring */}
        {canShowSection("schedulerScoring") && (
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

                <Select
                  value={fairnessWeight}
                  onValueChange={setFairnessWeight}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="0">0 - No Balancing</SelectItem>

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

                    <SelectItem value="10">10 - Low Penalty</SelectItem>

                    <SelectItem value="20">20 - Moderate Penalty</SelectItem>

                    <SelectItem value="30">30 - High Penalty</SelectItem>

                    <SelectItem value="40">40 - Very High Penalty</SelectItem>

                    <SelectItem value="50">50 - Maximum Penalty</SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-xs text-gray-500">
                  Higher values make the scheduler avoid assigning employees
                  after a previous night or overnight shift
                </p>
              </div>

              {/* Absence Tolerance */}
              <div className="space-y-2">
                <Label>Absence Tolerance</Label>

                <Select
                  value={absenceTolerance}
                  onValueChange={setAbsenceTolerance}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="0">0 - Very Sensitive</SelectItem>
                    <SelectItem value="25">25 - Sensitive</SelectItem>
                    <SelectItem value="50">50 - Balanced</SelectItem>
                    <SelectItem value="75">75 - Tolerant</SelectItem>
                    <SelectItem value="100">100 - Very Tolerant</SelectItem>
                  </SelectContent>
                </Select>

                <p className="text-xs text-gray-500">
                  Lower values make the genetic optimizer avoid employees with
                  past absence history more aggressively. Higher values make it
                  more forgiving.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Account Scheduling Policies */}
        {canShowSection("accountSchedulingPolicies") && (
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
              {Array.isArray(accountPolicies) &&
                accountPolicies.map((policy, index) => (
                  <div
                    key={policy.account_id ?? policy.id}
                    className="border rounded-lg p-4 space-y-4"
                  >
                    <div className="font-semibold">
                      {policy.account_name ?? policy.name}
                    </div>

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
                  </div>
                ))}
            </CardContent>
          </Card>
        )}
        {/* Scheduling Behavior */}
        {canShowSection("schedulingBehavior") && (
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
                    "Admin must manually approve normal cover request, emergency request will automatically transfer."}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
        {/* Notification Preferences */}
        {canShowSection("notificationPreferences") && (
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
        )}
      </div>

      {/* Action Bar */}
      {!isReadOnly && (
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
      )}
    </div>
  );
}
