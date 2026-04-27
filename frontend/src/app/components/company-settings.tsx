import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Switch } from "@/app/components/ui/switch";
import { Separator } from "@/app/components/ui/separator";
import { Building2, Clock, Users, Settings as SettingsIcon, Bell, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface ShiftTiming {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface CustomRole {
  id: string;
  roleName: string;
  requiredCount: number;
}

export function CompanySettings() {
  // Company Profile
  const [companyType, setCompanyType] = useState("Live Selling");
  const [companyName, setCompanyName] = useState("Live Stream Operations");
  const [accountCount, setAccountCount] = useState("50");
  const [branchCount, setBranchCount] = useState("2");

  // Scheduling Rules
  const [shiftsPerDay, setShiftsPerDay] = useState("4");
  const [maxShiftsPerEmployee, setMaxShiftsPerEmployee] = useState("5");
  const [maxAbsencePerEmployee, setMaxAbsencePerEmployee] = useState("3");
  const [maxConsecutiveWorkingDays, setMaxConsecutiveWorkingDays] = useState("6");
  const [minRestPeriod, setMinRestPeriod] = useState("8");
  const [doubleShiftAllowance, setDoubleShiftAllowance] = useState(true);

  // Shift Timings
  const [shiftTimings, setShiftTimings] = useState<ShiftTiming[]>([
    { id: "1", name: "AM", startTime: "08:00", endTime: "12:00" },
    { id: "2", name: "NN", startTime: "12:00", endTime: "16:00" },
    { id: "3", name: "PM", startTime: "16:00", endTime: "20:00" },
    { id: "4", name: "GY", startTime: "20:00", endTime: "00:00" },
  ]);

  // Staffing Requirements
  const [requiredHosts, setRequiredHosts] = useState("1");
  const [requiredOperators, setRequiredOperators] = useState("1");
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  // Scheduling Behavior
  const [absenceReplacementMode, setAbsenceReplacementMode] = useState("Automatic");

  // Notification Preferences
  const [inAppNotifications, setInAppNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  const handleAddShift = () => {
    const newShift: ShiftTiming = {
      id: Date.now().toString(),
      name: "",
      startTime: "09:00",
      endTime: "17:00",
    };
    setShiftTimings([...shiftTimings, newShift]);
  };

  const handleRemoveShift = (id: string) => {
    setShiftTimings(shiftTimings.filter((shift) => shift.id !== id));
  };

  const handleUpdateShift = (id: string, field: keyof ShiftTiming, value: string) => {
    setShiftTimings(
      shiftTimings.map((shift) =>
        shift.id === id ? { ...shift, [field]: value } : shift
      )
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

  const handleUpdateRole = (id: string, field: keyof CustomRole, value: string | number) => {
    setCustomRoles(
      customRoles.map((role) =>
        role.id === id ? { ...role, [field]: value } : role
      )
    );
  };

  const handleSaveChanges = () => {
    toast.success("Company settings saved successfully");
  };

  const handleCancel = () => {
    toast.info("Changes discarded");
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h2 className="text-3xl">Company Settings</h2>
        <p className="text-gray-600">Configure scheduling rules, shifts, and notification preferences</p>
      </div>

      {/* Company Profile Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-blue-600" />
            <CardTitle>Company Profile</CardTitle>
          </div>
          <CardDescription>Basic information about your organization</CardDescription>
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

            <div className="space-y-2">
              <Label htmlFor="accountCount">Account Count</Label>
              <Input
                id="accountCount"
                type="number"
                value={accountCount}
                onChange={(e) => setAccountCount(e.target.value)}
                placeholder="Enter account count"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branchCount">Branch / Department Count</Label>
              <Input
                id="branchCount"
                type="number"
                value={branchCount}
                onChange={(e) => setBranchCount(e.target.value)}
                placeholder="Optional"
              />
              <p className="text-xs text-gray-500">Leave empty if not applicable</p>
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
          <CardDescription>Define constraints and limits for employee scheduling</CardDescription>
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
              <p className="text-xs text-gray-500">Maximum absences per month</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxConsecutive">Max Consecutive Working Days</Label>
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
              <Label htmlFor="minRest">Minimum Rest Period Between Shifts</Label>
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
                  <p className="text-xs text-gray-500">Allow employees to work consecutive shifts</p>
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
              <CardDescription>Define shift schedules and operating hours</CardDescription>
            </div>
            <Button onClick={handleAddShift} variant="outline" size="sm" className="gap-2">
              <Plus className="size-4" />
              Add Shift
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {shiftTimings.map((shift, index) => (
              <div key={shift.id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
                  <div className="space-y-2">
                    <Label htmlFor={`shiftName-${shift.id}`}>Shift Name</Label>
                    <Input
                      id={`shiftName-${shift.id}`}
                      value={shift.name}
                      onChange={(e) => handleUpdateShift(shift.id, "name", e.target.value)}
                      placeholder="e.g., AM, PM, GY"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`startTime-${shift.id}`}>Start Time</Label>
                    <Input
                      id={`startTime-${shift.id}`}
                      type="time"
                      value={shift.startTime}
                      onChange={(e) => handleUpdateShift(shift.id, "startTime", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`endTime-${shift.id}`}>End Time</Label>
                    <Input
                      id={`endTime-${shift.id}`}
                      type="time"
                      value={shift.endTime}
                      onChange={(e) => handleUpdateShift(shift.id, "endTime", e.target.value)}
                    />
                  </div>
                  {shiftTimings.length > 1 && (
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveShift(shift.id)}
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
          <CardDescription>Define required roles and headcount per shift</CardDescription>
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
              <Label htmlFor="requiredOperators">Required Operators per Shift</Label>
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
                  <div key={role.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end">
                    <div className="space-y-2">
                      <Label htmlFor={`roleName-${role.id}`}>Role Name</Label>
                      <Input
                        id={`roleName-${role.id}`}
                        value={role.roleName}
                        onChange={(e) => handleUpdateRole(role.id, "roleName", e.target.value)}
                        placeholder="e.g., Moderator, Tech Support"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`roleCount-${role.id}`}>Required Count</Label>
                      <Input
                        id={`roleCount-${role.id}`}
                        type="number"
                        value={role.requiredCount}
                        onChange={(e) => handleUpdateRole(role.id, "requiredCount", parseInt(e.target.value) || 1)}
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

          <Button onClick={handleAddRole} variant="outline" size="sm" className="gap-2">
            <Plus className="size-4" />
            Add Role
          </Button>
        </CardContent>
      </Card>

      {/* Scheduling Behavior */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-blue-600" />
            <CardTitle>Scheduling Behavior</CardTitle>
          </div>
          <CardDescription>Configure how the system handles scheduling decisions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="absenceMode">Absence Replacement Mode</Label>
            <Select value={absenceReplacementMode} onValueChange={setAbsenceReplacementMode}>
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
              {absenceReplacementMode === "Automatic" && "System automatically assigns replacements when someone is absent"}
              {absenceReplacementMode === "Manual" && "Admin must manually approve all replacement assignments"}
              {absenceReplacementMode === "Hybrid" && "System suggests replacements but requires admin approval"}
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
          <CardDescription>Choose how you receive system notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inAppNotif">In-app Notifications</Label>
              <p className="text-xs text-gray-500">Receive notifications within the application</p>
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
              <p className="text-xs text-gray-500">Receive notifications via email</p>
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
              <p className="text-xs text-gray-500">Receive notifications via text message</p>
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
          <Button onClick={handleSaveChanges}>
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
