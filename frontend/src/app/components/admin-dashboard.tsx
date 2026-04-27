// src/app/components/admin-dashboard.tsx

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { EmployeeProfile } from "@/app/components/employee-profile";

import {
  Users,
  User,
  UserPlus,
  UserMinus,
  CheckCircle,
  XCircle,
  Clock,
  BarChart3,
  AlertTriangle,
  RefreshCw,
  Calendar,
  CalendarOff
} from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: number;
  name: string;
  email: string;
  contactNumber?: string;
  role: "Host" | "Operator" | "Both" | "Team Leader";
  status: "Active" | "Inactive";
  totalShifts: number;
  joinedDate: string;
}

interface Request {
  id: string;
  type: "application" | "cover" | "leave";
  requester: string;
  livestream: string;
  day: string;
  shift: string;
  role: "Host" | "Operator";
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
  role: "Host" | "Operator";
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
  currentUser: string;
}

const SHIFTS = [
  { code: "GY", name: "Graveyard", time: "01:00 - 07:00" },
  { code: "AM", name: "Morning", time: "07:00 - 13:00" },
  { code: "NN", name: "Noon", time: "13:00 - 19:00" },
  { code: "PM", name: "Evening", time: "19:00 - 01:00" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LIVESTREAMS = ["Mommypoko", "Sofy"];

export function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [requests, setRequests] = useState<Request[]>([
    {
      id: "1",
      type: "application",
      requester: "Mike Davis",
      livestream: "Mommypoko",
      day: "Thursday",
      shift: "GY",
      role: "Host",
      reason: "Looking for extra hours",
      status: "pending",
      submittedAt: "2026-01-25T10:30:00",
    },
    {
      id: "2",
      type: "cover",
      requester: "Sarah Johnson",
      livestream: "Mommypoko",
      day: "Wednesday",
      shift: "NN",
      role: "Host",
      reason: "Medical appointment",
      status: "pending",
      submittedAt: "2026-01-25T10:30:00",
    },
    {
      id: "3",
      type: "leave",
      requester: "John Smith",
      livestream: "Mommypoko",
      day: "Friday",
      shift: "AM",
      role: "Host",
      leaveType: "Sick Leave",
      reason: "Medical appointment",
      status: "pending",
      submittedAt: "2026-01-25T09:00:00",
    },
    {
      id: "4",
      type: "application",
      requester: "Emma Wilson",
      livestream: "Sofy",
      day: "Friday",
      shift: "NN",
      role: "Operator",
      reason: "Can cover this shift",
      status: "approved",
      submittedAt: "2026-01-24T14:20:00",
    },
  ]);

  const [assignments, setAssignments] = useState<Assignment[]>([
    { id: "1", livestream: "Mommypoko", day: "Monday", shift: "AM", role: "Host", employee: "John Smith", approvedBy: "Admin", approvedAt: "2026-01-20" },
    { id: "2", livestream: "Mommypoko", day: "Monday", shift: "AM", role: "Operator", employee: "Sarah Johnson", approvedBy: "Admin", approvedAt: "2026-01-20" },
    { id: "3", livestream: "Sofy", day: "Tuesday", shift: "NN", role: "Host", employee: "Mike Davis" },
    { id: "4", livestream: "Sofy", day: "Wednesday", shift: "PM", role: "Operator", employee: "Emma Wilson", approvedBy: "Admin", approvedAt: "2026-01-22" },
  ]);

  // Employee Management States
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState("");
  const [newEmployeeEmail, setNewEmployeeEmail] = useState("");
  const [newEmployeeContactNumber, setNewEmployeeContactNumber] = useState("");
  const [newEmployeeRole, setNewEmployeeRole] = useState<"Host" | "Operator" | "Both" | "Team Leader">("Host");

  // Override Dialog States
  const [isOverrideDialogOpen, setIsOverrideDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [overrideEmployee, setOverrideEmployee] = useState("");

  // Day Off Management States
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<number | null>(null);

  const [selectedEmployeeForDayOff, setSelectedEmployeeForDayOff] = useState<number | null>(null);

  const [employeeDayOffs, setEmployeeDayOffs] = useState<EmployeeDayOff[]>([]);

  const fetchEmployees = () => {
    fetch("https://thesisprogram-production.up.railway.app/employees")
      .then(res => res.json())
      .then(data => setEmployees(data))
      .catch(() => console.log("Failed to load employees"));
  };

  useEffect(() => {
    fetchEmployees();
  }, []);


  // Add Employee
  const handleAddEmployee = async () => {
    if (!newEmployeeName || !newEmployeeEmail.includes("@")) {
      toast.error("Valid email required");
      return;
    }

    try {
      const res = await fetch("https://thesisprogram-production.up.railway.app/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newEmployeeName,
          email: newEmployeeEmail,
          contactNumber: newEmployeeContactNumber,
          role: newEmployeeRole
        })
      });

      if (!res.ok) {
        const errorData = await res.text();
        throw new Error(errorData || "Failed to add employee");
      }

   fetchEmployees();
     setIsAddEmployeeOpen(false);

    setNewEmployeeName("");
    setNewEmployeeEmail("");
    setNewEmployeeContactNumber("");
    setNewEmployeeRole("Host");

      toast.success("Employee added");

    } catch (err) {
      console.error(err);
      toast.error("Failed to add employee");
    }
  };

  // Remove Employee
 const confirmRemoveEmployee = async () => {
    if (!employeeToDelete) return;

    await fetch(`https://thesisprogram-production.up.railway.app/employees/${employeeToDelete}`, {
      method: "DELETE"
    });

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
          : emp
      )
    );
    toast.success("Employee status updated");
  };

  // Update Employee Role
  const updateEmployeeRole = async (
    id: number, 
    role: "Host" | "Operator" | "Both" | "Team Leader"
  ) => {
    await fetch(`https://thesisprogram-production.up.railway.app/employees/${id}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role })
    });

    fetchEmployees(); 
  };

  // Approve/Decline Request
  const updateRequestStatus = (id: string, status: "approved" | "denied") => {
    setRequests(
      requests.map((req) =>
        req.id === id ? { ...req, status } : req
      )
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
          ? { ...a, employee: overrideEmployee, approvedBy: currentUser, approvedAt: new Date().toISOString().split('T')[0] }
          : a
      )
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
  const isSlotUnavailable = (employeeId: number, day: string, shift: string): boolean => {
    const employeeDayOff = employeeDayOffs.find((edo) => edo.employeeId === employeeId);
    if (!employeeDayOff) return false;
    return employeeDayOff.unavailableSlots.some((slot) => slot.day === day && slot.shift === shift);
  };

  const toggleSlotAvailability = (employeeId: number, day: string, shift: string) => {
    const employeeDayOffIndex = employeeDayOffs.findIndex((edo) => edo.employeeId === employeeId);

    if (employeeDayOffIndex === -1) {
      setEmployeeDayOffs([
        ...employeeDayOffs,
        {
          employeeId,
          unavailableSlots: [{ day, shift }]
        }
      ]);
      toast.success("Shift marked as unavailable");
      return;
    }

    const employeeDayOff = employeeDayOffs[employeeDayOffIndex];
    const slotIndex = employeeDayOff.unavailableSlots.findIndex(
      (slot) => slot.day === day && slot.shift === shift
    );

    if (slotIndex === -1) {
      const updatedDayOffs = [...employeeDayOffs];
      updatedDayOffs[employeeDayOffIndex] = {
        ...employeeDayOff,
        unavailableSlots: [...employeeDayOff.unavailableSlots, { day, shift }]
      };
      setEmployeeDayOffs(updatedDayOffs);
      toast.success("Shift marked as unavailable");
    } else {
      const updatedDayOffs = [...employeeDayOffs];
      updatedDayOffs[employeeDayOffIndex] = {
        ...employeeDayOff,
        unavailableSlots: employeeDayOff.unavailableSlots.filter((_, i) => i !== slotIndex)
      };
      setEmployeeDayOffs(updatedDayOffs);
      toast.success("Shift marked as available");
    }
  };

  // Statistics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((e) => e.status === "Active").length;
  const pendingRequests = requests.filter((r) => r.status === "pending").length;
  const totalAssignments = assignments.length;
  const totalSlots = DAYS.length * SHIFTS.length * LIVESTREAMS.length * 2; // 2 roles per shift
  const isAdmin = (employee: Employee) => employee.role === "Team Leader";

  const currentEmployee = employees.find(
    (e) =>
      e.email?.trim().toLowerCase() === currentUser.trim().toLowerCase()
  );

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
    return SHIFTS.find((s) => s.code === code);
  };

    if (employees.length === 0) {
      return <div className="p-6">Loading...</div>;
    }

    console.log("currentUser:", currentUser);
    console.log("employees:", employees);
    console.log("matched employee:", currentEmployee);
    console.log("role:", currentEmployee?.role);

    if (!currentEmployee || !isAdmin(currentEmployee)) {
      return (
        <div className="p-6">
          <p className="text-red-500 text-lg font-semibold">
            Access denied. Admins only.
          </p>
        </div>
      );
    }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl">Admin Dashboard</h2>
        <p className="text-gray-600">Manage employees, schedules, and approvals</p>
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
                <p className="text-2xl font-bold">{totalAssignments} / {totalSlots}</p>
              </div>
              <BarChart3 className="size-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="employees" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-3">
          <TabsTrigger value="employees" className="gap-2">
            <Users className="size-4" />
            Employees
          </TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2">
            <Calendar className="size-4" />
            Assignments
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <User className="size-4" />
            Profile
          </TabsTrigger>
        </TabsList>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Employee Management</CardTitle>
                  <CardDescription>Add, remove, or modify employee details</CardDescription>
                </div>
                <Button onClick={() => setIsAddEmployeeOpen(true)} className="gap-2">
                  <UserPlus className="size-4" />
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
                      <TableHead>Total Shifts</TableHead>
                      <TableHead>Joined Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...employees]
                    .sort((a, b) => {
                      const rolePriority: Record<string, number> = {
                        "Team Leader": 1,
                        "Host": 2,
                        "Operator": 3,
                        "Both": 4
                      };

                      return (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99);
                    })
                    .map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">{employee.name}</TableCell>
                        <TableCell>
                          <Select
                            value={employee.role}
                            onValueChange={(value) =>
                              updateEmployeeRole(employee.id, value as "Host" | "Operator" | "Both" | "Team Leader")
                            }
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Team Leader">Team Leader</SelectItem>
                              <SelectItem value="Host">Host</SelectItem>
                              <SelectItem value="Operator">Operator</SelectItem>
                              <SelectItem value="Both">Both</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={employee.status === "Active" ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => toggleEmployeeStatus(employee.id)}
                          >
                            {employee.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{employee.totalShifts}</TableCell>
                        <TableCell>{new Date(employee.joinedDate).toLocaleDateString()}</TableCell>
                        <TableCell>
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
                        </TableCell>
                      </TableRow>
                    ))}
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
                  <CardDescription>Manage weekly unavailable shifts for employees</CardDescription>
                </div>
                <div className="w-64">
                  <Select
                    value={selectedEmployeeForDayOff?.toString() || ""}
                    onValueChange={(value) => setSelectedEmployeeForDayOff(Number(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id.toString()}>
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
                    Click on any shift to toggle availability. Greyed out shifts are unavailable.
                  </p>
                  <div className="overflow-x-auto">
                    <div className="min-w-max">
                      <div className="grid grid-cols-8 gap-2">
                        <div className="font-medium p-3"></div>
                        {DAYS.map((day) => (
                          <div key={day} className="font-medium p-3 text-center bg-gray-100 rounded">
                            {day}
                          </div>
                        ))}
                      </div>

                      {SHIFTS.map((shift) => (
                        <div key={shift.code} className="grid grid-cols-8 gap-2 mt-2">
                          <div className="p-3 font-medium bg-gray-100 rounded flex flex-col justify-center">
                            <div>{shift.code} - {shift.name}</div>
                            <div className="text-xs text-gray-600">{shift.time}</div>
                          </div>
                          {DAYS.map((day) => {
                            const isUnavailable = isSlotUnavailable(selectedEmployeeForDayOff, day, shift.code);
                            return (
                              <div
                                key={`${day}-${shift.code}`}
                                onClick={() => toggleSlotAvailability(selectedEmployeeForDayOff, day, shift.code)}
                                className={`
                                  p-3 rounded border-2 cursor-pointer transition-all min-h-[60px] flex items-center justify-center
                                  ${isUnavailable
                                    ? 'bg-gray-300 border-gray-400 text-gray-500'
                                    : 'bg-white border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                                  }
                                `}
                              >
                                <span className="text-sm font-medium">
                                  {isUnavailable ? 'Unavailable' : 'Available'}
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
                  <p>Select an employee to view and manage their day off schedule</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Schedule Assignments</CardTitle>
              <CardDescription>Override or remove existing assignments</CardDescription>
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
                              <span className="font-semibold text-blue-700">{assignment.livestream}</span>
                            </TableCell>
                            <TableCell>{assignment.day}</TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{assignment.shift} - {shiftInfo?.name}</span>
                                <span className="text-xs text-gray-600">{shiftInfo?.time}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{assignment.role}</Badge>
                            </TableCell>
                            <TableCell className="font-medium">{assignment.employee}</TableCell>
                            <TableCell>
                              {assignment.approvedBy ? (
                                <span className="text-sm">{assignment.approvedBy}</span>
                              ) : (
                                <span className="text-sm text-gray-400">Not approved</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {assignment.approvedAt ? (
                                <span className="text-sm">{new Date(assignment.approvedAt).toLocaleDateString()}</span>
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
                                  onClick={() => handleRemoveAssignment(assignment.id)}
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
                <p className="text-sm text-gray-500 py-4">No assignments found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {currentEmployee && (
            <EmployeeProfile
              userId={currentEmployee.id}
              role={currentEmployee.role}
              onProfileUpdated={fetchEmployees}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Add Employee Dialog */}
      <Dialog open={isAddEmployeeOpen} onOpenChange={setIsAddEmployeeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>
              Enter employee details to add them to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
              <Label htmlFor="employeeContactNumber">Contact Number (Optional)</Label>
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
            <div className="space-y-2">
              <Label htmlFor="employeeRole">Role</Label>
              <Select value={newEmployeeRole} onValueChange={(value) => setNewEmployeeRole(value as "Host" | "Operator" | "Both" | "Team Leader")}>
                <SelectTrigger id="employeeRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Team Leader">Team Leader</SelectItem>
                  <SelectItem value="Host">Host</SelectItem>
                  <SelectItem value="Operator">Operator</SelectItem>
                  <SelectItem value="Both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEmployeeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEmployee}>Add Employee</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Assignment Dialog */}
      <Dialog open={isOverrideDialogOpen} onOpenChange={setIsOverrideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Assignment</DialogTitle>
            <DialogDescription>
              {selectedAssignment && (
                <div className="space-y-1 mt-2">
                  <div><strong>Livestream:</strong> {selectedAssignment.livestream}</div>
                  <div><strong>Day:</strong> {selectedAssignment.day}</div>
                  <div><strong>Shift:</strong> {getShiftInfo(selectedAssignment.shift)?.name} ({getShiftInfo(selectedAssignment.shift)?.time})</div>
                  <div><strong>Role:</strong> {selectedAssignment.role}</div>
                  <div><strong>Current Employee:</strong> {selectedAssignment.employee}</div>
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
            <Button variant="outline" onClick={() => setIsOverrideDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOverrideAssignment}>Override Assignment</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      
{/* Confirm Delete Employee Dialog */}
<Dialog open={isConfirmDeleteOpen} onOpenChange={setIsConfirmDeleteOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Deactivate Employee</DialogTitle>
      <DialogDescription>
        Are you sure you want to deactivate this employee? They will no longer be scheduled but their data will be preserved.
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

      <Button
        variant="destructive"
        onClick={confirmRemoveEmployee}
      >
        Yes, Deactivate
      </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}