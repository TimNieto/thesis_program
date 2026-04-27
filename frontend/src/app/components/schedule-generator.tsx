// src/app/components/schedule-generator.tsx

import React, { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/app/components/ui/dialog";
import { Badge } from "@/app/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Calendar, Download, Trash2, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { toast } from "sonner";

interface ShiftAssignment {
  id: string;
  livestream: string;
  day: string;
  shift: string;
  role: "Host" | "Operator";
  employee: string;
}

interface LeaveRequest {
  id: string;
  employee: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: "pending" | "approved" | "denied";
  reason: string;
}

interface ScheduleGeneratorProps {
  currentUser: string;
  role: string;
}

const SHIFTS = [
  { code: "GY", name: "Graveyard", time: "01:00 - 07:00" },
  { code: "AM", name: "Morning", time: "07:00 - 13:00" },
  { code: "NN", name: "Noon", time: "13:00 - 19:00" },
  { code: "PM", name: "Evening", time: "19:00 - 01:00" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const LIVESTREAMS = ["Mommypoko", "Sofy"];
const ROLES = ["Host", "Operator"] as const;

export function ScheduleGenerator({ currentUser, role }: ScheduleGeneratorProps) {
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);

  /*const assignmentMap = React.useMemo(() => {
    const map = new Map<string, ShiftAssignment>();

    assignments.forEach(a => {
      const key = `${a.livestream}-${a.day}-${a.shift}-${a.role}`;
      map.set(key, a);
    });

    return map;
  }, [assignments]);*/

  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([
    {
      id: "1",
      employee: "John Smith",
      leaveType: "Sick Leave",
      startDate: "2026-04-14", // Monday
      endDate: "2026-04-16", // Wednesday
      status: "approved",
      reason: "Medical appointment",
    },
    {
      id: "2",
      employee: "Sarah Johnson",
      leaveType: "Annual Leave",
      startDate: "2026-04-15", // Tuesday
      endDate: "2026-04-15", // Tuesday
      status: "approved",
      reason: "Personal matters",
    },
    {
      id: "3",
      employee: "Mike Davis",
      leaveType: "Annual Leave",
      startDate: "2026-04-21", // Next week Monday
      endDate: "2026-04-23", // Next week Wednesday
      status: "approved",
      reason: "Vacation",
    },
  ]);
  
    const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const leaveMap = React.useMemo(() => {
      const map = new Map<string, LeaveRequest[]>();
  
      approvedLeaves.forEach(leave => {
        let current = new Date(leave.startDate);
        const end = new Date(leave.endDate);
  
        while (current <= end) {
          const key = formatDate(current);
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(leave);
          current.setDate(current.getDate() + 1);
        }
      });
  
      return map;
    }, [approvedLeaves]);
  
    const uniqueEmployeesOnLeave = React.useMemo(() => {
      return Array.from(new Set(approvedLeaves.map(l => l.employee)));
    }, [approvedLeaves]);

  const [selectedCell, setSelectedCell] = useState<{ livestream: string; day: string; shift: string; role: "Host" | "Operator" } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [leaveWeekOffset, setLeaveWeekOffset] = useState(0); // 0 = current week, 1 = next week

  // Get date range for week based on offset
  const getWeekDates = (offset: number = 0) => {
    const today = new Date(2026, 3, 9); // April 9, 2026 (Thursday)
    const currentDay = today.getDay() || 7; // Make Sunday = 7 instead of 0
    const mondayOffset = currentDay === 1 ? 0 : -(currentDay - 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + (offset * 7));
    
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };


  const isEmployeeOnLeave = (employeeName: string, date: Date) => {
    const dateStr = formatDate(date);
    return approvedLeaves.some(leave => {
      if (leave.employee !== employeeName) return false;
      return dateStr >= leave.startDate && dateStr <= leave.endDate;
    });
  };


   const getLeavesForDate = (date: Date) => {
    return leaveMap.get(formatDate(date)) || [];
  };

/*const getAssignment = (
    livestream: string,
    day: string,
    shift: string,
    role: "Host" | "Operator"
  ) => {
    return assignmentMap.get(`${livestream}-${day}-${shift}-${role}`);
  };*/  

  const getAssignment = (
  livestream: string,
  day: string,
  shift: string,
  role: "Host" | "Operator"
) => {
  return assignments.find(
    (a) =>
      a.livestream === livestream &&
      a.day === day &&
      a.shift === shift &&
      a.role === role
  );
};

  const openAssignDialog = (livestream: string, day: string, shift: string, role: "Host" | "Operator") => {
    setSelectedCell({ livestream, day, shift, role });
    const existing = getAssignment(livestream, day, shift, role);
    setEmployeeName(existing?.employee || "");
    setIsDialogOpen(true);
  };

  const handleAssign = () => {
    if (!selectedCell || !employeeName.trim()) {
      toast.error("Please enter an employee name");
      return;
    }

    const existing = getAssignment(selectedCell.livestream, selectedCell.day, selectedCell.shift, selectedCell.role);
    
    if (existing) {
      setAssignments(
        assignments.map((a) =>
          a.id === existing.id ? { ...a, employee: employeeName } : a
        )
      );
      toast.success("Shift updated successfully");
    } else {
      const newAssignment: ShiftAssignment = {
        id: Date.now().toString(),
        livestream: selectedCell.livestream,
        day: selectedCell.day,
        shift: selectedCell.shift,
        role: selectedCell.role,
        employee: employeeName,
      };
      setAssignments([...assignments, newAssignment]);
      toast.success("Shift assigned successfully");
    }

    setIsDialogOpen(false);
    setEmployeeName("");
    setSelectedCell(null);
  };

  const handleRemove = () => {
    if (!selectedCell) return;

    const existing = getAssignment(selectedCell.livestream, selectedCell.day, selectedCell.shift, selectedCell.role);
    if (existing) {
      setAssignments(assignments.filter((a) => a.id !== existing.id));
      toast.success("Assignment removed");
    }

    setIsDialogOpen(false);
    setEmployeeName("");
    setSelectedCell(null);
  };

  const exportSchedule = () => {
    const csv = [
      ["Livestream", "Day", "Shift", "Time", "Role", "Employee"],
      ...assignments.map((a) => {
        const shiftInfo = SHIFTS.find((s) => s.code === a.shift);
        return [a.livestream, a.day, a.shift, shiftInfo?.time || "", a.role, a.employee];
      }),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "schedule.csv";
    link.click();
  };
  
  const generateSchedule = async () => {
    try {
      /*const grouped = {
      Mommypoko: {
        Monday: {
          GY: {
            host: [{ employee_name: "John Doe" }],
            operator: [{ employee_name: "Jane Doe" }]
          }
        }
      }
    };*/

      const res = await fetch("https://thesisprogram-production.up.railway.app/generate-schedule");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed");
      }

      const grouped = data.grouped_schedule || {};
      const unfilled = data.unfilled_slots || [];

     //const unfilled: any[] = [];

      const transformed: ShiftAssignment[] = [];

      let idCounter = 0;

      // 🔥 KEEP UI SAME → still loop livestreams
      Object.entries(grouped).forEach(([livestream, days]) => {
        DAYS.forEach((day) => {
          const shifts = days[day] || {};

          SHIFTS.forEach((shift) => {
            const shiftData = shifts[shift.code] || {};

            // HOSTS
            (shiftData.host || []).forEach((emp: any) => {
              transformed.push({
                id: String(idCounter++),
                livestream,
                day,
                shift: shift.code,
                role: "Host",
                employee: emp.employee_name,
              });
            });

            // OPERATORS
            (shiftData.operator || []).forEach((emp: any) => {
              transformed.push({
                id: String(idCounter++),
                livestream,
                day,
                shift: shift.code,
                role: "Operator",
                employee: emp.employee_name,
              });
            });

          });
        });
      });

      setAssignments([...transformed]);

      /*console.log("TRANSFORMED:", transformed);
      setAssignments([...transformed]);*/

      if (unfilled.length > 0) {
        toast.warning(`${unfilled.length} slots could not be filled`);
      } else {
        toast.success("Schedule generated successfully");
      }

    } catch (err) {
      console.error(err);
      toast.error("Failed to generate schedule");
    }
  };

  const getShiftColor = (shift: string) => {
    const colors = {
      GY: "bg-indigo-100",
      AM: "bg-yellow-100",
      NN: "bg-orange-100",
      PM: "bg-blue-100",
    };
    return colors[shift as keyof typeof colors] || "bg-gray-100";
  };

  const getShiftTextColor = (shift: string) => {
    const colors = {
      GY: "text-indigo-700",
      AM: "text-yellow-700",
      NN: "text-orange-700",
      PM: "text-blue-700",
    };
    return colors[shift as keyof typeof colors] || "text-gray-700";
  };

  const weekDates = React.useMemo(
      () => getWeekDates(leaveWeekOffset),
      [leaveWeekOffset]
    );
  const weekLabel = leaveWeekOffset === 0 ? "This Week" : "Next Week";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl">Schedule Generator</h2>
          <p className="text-gray-600">Weekly livestream shift allocation and leave management</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary">{role}</Badge>
          <Button onClick={generateSchedule} className="gap-2">
                      Generate Schedule
                    </Button>
          <Button onClick={exportSchedule} variant="outline" className="gap-2">
            <Download className="size-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Shift Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {SHIFTS.map((shift) => (
              <div key={shift.code} className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded border-2 ${getShiftColor(shift.code)} flex items-center justify-center`}>
                  <span className={`font-semibold text-xs ${getShiftTextColor(shift.code)}`}>{shift.code}</span>
                </div>
                <div>
                  <div className="text-sm font-medium">{shift.name}</div>
                  <div className="text-xs text-gray-600">{shift.time}</div>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded border-2 bg-pink-100 border-pink-300 flex items-center justify-center">
                <span className="font-semibold text-xs">H</span>
              </div>
              <div className="text-sm font-medium">Host</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded border-2 bg-purple-100 border-purple-300 flex items-center justify-center">
                <span className="font-semibold text-xs">O</span>
              </div>
              <div className="text-sm font-medium">Operator</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="schedule" className="gap-2">
            <Calendar className="size-4" />
            Weekly Schedule
          </TabsTrigger>
          <TabsTrigger value="leaves" className="gap-2">
            <CalendarDays className="size-4" />
            Approved Leaves
          </TabsTrigger>
        </TabsList>

        {/* Weekly Schedule Tab */}
        <TabsContent value="schedule" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="size-5" />
                Weekly Schedule
              </CardTitle>
              <CardDescription>
                {role === "admin" 
                  ? "Click on any cell to assign or modify shifts"
                  : "View shift assignments for all livestreams"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {LIVESTREAMS.map((livestream) => (
                  <div key={livestream} className="mb-8">
                    {/* Livestream Header */}
                    <div className="bg-blue-600 text-white p-3 rounded-t-lg">
                      <h3 className="text-lg font-bold text-center">{livestream}</h3>
                    </div>

                    {/* Schedule Table for this Livestream */}
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="border border-gray-300 bg-gray-100 p-3 text-left font-semibold min-w-[120px]">
                            Shift
                          </th>
                          <th className="border border-gray-300 bg-gray-100 p-3 text-center font-semibold min-w-[80px]">
                            Role
                          </th>
                          {DAYS.map((day) => (
                            <th
                              key={day}
                              className="border border-gray-300 bg-gray-100 p-3 text-center font-semibold min-w-[120px]"
                            >
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {SHIFTS.map((shift) => (
                          <React.Fragment key={shift.code}>
                            {/* Host Row */}
                            <tr key={`${livestream}-${shift.code}-host`}>
                              <td 
                                rowSpan={2} 
                                className={`border border-gray-300 p-3 ${getShiftColor(shift.code)}`}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-10 h-10 rounded border-2 ${getShiftColor(shift.code)} flex items-center justify-center`}>
                                    <span className={`font-semibold text-sm ${getShiftTextColor(shift.code)}`}>{shift.code}</span>
                                  </div>
                                  <div>
                                    <div className="font-semibold text-sm">{shift.name}</div>
                                    <div className="text-xs text-gray-600">{shift.time}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="border border-gray-300 bg-pink-50 p-2 text-center font-semibold text-sm">
                                Host
                              </td>
                              {DAYS.map((day) => {
                                const assignment = getAssignment(livestream, day, shift.code, "Host");
                                const isClickable = role === "admin";
                                
                                return (
                                  <td
                                    key={`${livestream}-${day}-${shift.code}-host`}
                                    className={`border border-gray-300 p-2 ${
                                      assignment ? getShiftColor(shift.code) : "bg-white"
                                    } ${isClickable ? "cursor-pointer hover:bg-gray-100" : ""}`}
                                    onClick={() => isClickable && openAssignDialog(livestream, day, shift.code, "Host")}
                                  >
                                    {assignment ? (
                                      <div className="text-center">
                                        <div className={`font-medium text-sm ${getShiftTextColor(shift.code)}`}>
                                          {assignment.employee}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center text-gray-300 text-xs py-1">
                                        {isClickable ? "+" : "-"}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                            
                            {/* Operator Row */}
                            <tr key={`${livestream}-${shift.code}-operator`}>
                              <td className="border border-gray-300 bg-purple-50 p-2 text-center font-semibold text-sm">
                                Operator
                              </td>
                              {DAYS.map((day) => {
                                const assignment = getAssignment(livestream, day, shift.code, "Operator");
                                const isClickable = role === "admin";
                                
                                return (
                                  <td
                                    key={`${livestream}-${day}-${shift.code}-operator`}
                                    className={`border border-gray-300 p-2 ${
                                      assignment ? getShiftColor(shift.code) : "bg-white"
                                    } ${isClickable ? "cursor-pointer hover:bg-gray-100" : ""}`}
                                    onClick={() => isClickable && openAssignDialog(livestream, day, shift.code, "Operator")}
                                  >
                                    {assignment ? (
                                      <div className="text-center">
                                        <div className={`font-medium text-sm ${getShiftTextColor(shift.code)}`}>
                                          {assignment.employee}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center text-gray-300 text-xs py-1">
                                        {isClickable ? "+" : "-"}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          </React.Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approved Leaves Tab */}
        <TabsContent value="leaves" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarDays className="size-5" />
                    Approved Leaves - {weekLabel}
                  </CardTitle>
                  <CardDescription>
                    View approved employee leave requests for the week
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaveWeekOffset(0)}
                    disabled={leaveWeekOffset === 0}
                    className="gap-2"
                  >
                    <ChevronLeft className="size-4" />
                    This Week
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaveWeekOffset(1)}
                    disabled={leaveWeekOffset === 1}
                    className="gap-2"
                  >
                    Next Week
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-gray-300 bg-gray-100 p-3 text-left font-semibold min-w-[150px]">
                        Employee
                      </th>
                      {weekDates.map((date, index) => (
                        <th
                          key={index}
                          className="border border-gray-300 bg-gray-100 p-3 text-center font-semibold min-w-[120px]"
                        >
                          <div>{DAYS[index]}</div>
                          <div className="text-xs font-normal text-gray-600">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* Get unique employees from approved leaves */}
                    {uniqueEmployeesOnLeave.map((employee) => {
                      const hasLeaveThisWeek = weekDates.some(date => {
                        const leaves = getLeavesForDate(date);
                        return leaves.some(l => l.employee === employee);
                      });
                      if (!hasLeaveThisWeek) return null;

                      return (
                        <tr key={employee}>
                          <td className="border border-gray-300 p-3 font-medium">
                            {employee}
                          </td>
                          {weekDates.map((date, index) => {
                            const leaves = getLeavesForDate(date);
                            const leave = leaves.find(l => l.employee === employee);
                            const isOnLeave = !!leave;

                            return (
                              <td
                                key={index}
                                className={`border border-gray-300 p-2 ${
                                  isOnLeave ? "bg-red-100" : "bg-white"
                                }`}
                              >
                                {isOnLeave && leave ? (
                                  <div className="text-center">
                                    <Badge variant="destructive" className="text-xs">
                                      {leave.leaveType}
                                    </Badge>
                                    <div className="text-xs text-gray-600 mt-1">
                                      {leave.reason}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-center text-gray-300 text-xs py-1">-</div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Show message if no leaves */}
                {!approvedLeaves.some(leave => {
                  const startDate = new Date(leave.startDate);
                  const endDate = new Date(leave.endDate);
                  return weekDates.some(date => date >= startDate && date <= endDate);
                }) && (
                  <div className="text-center py-8 text-gray-500">
                    No approved leaves for {weekLabel.toLowerCase()}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCell && getAssignment(selectedCell.livestream, selectedCell.day, selectedCell.shift, selectedCell.role)
                ? "Modify Assignment"
                : "Assign Shift"}
            </DialogTitle>
            <DialogDescription>
              {selectedCell && (
                <div className="space-y-1 mt-2">
                  <div><strong>Livestream:</strong> {selectedCell.livestream}</div>
                  <div><strong>Day:</strong> {selectedCell.day}</div>
                  <div><strong>Shift:</strong> {SHIFTS.find((s) => s.code === selectedCell.shift)?.name} (
                  {SHIFTS.find((s) => s.code === selectedCell.shift)?.time})</div>
                  <div><strong>Role:</strong> {selectedCell.role}</div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="employeeName">Employee Name</Label>
              <Input
                id="employeeName"
                placeholder="Enter employee name"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAssign();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            {selectedCell && getAssignment(selectedCell.livestream, selectedCell.day, selectedCell.shift, selectedCell.role) && (
              <Button variant="destructive" onClick={handleRemove} className="gap-2">
                <Trash2 className="size-4" />
                Remove
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign}>
              {selectedCell && getAssignment(selectedCell.livestream, selectedCell.day, selectedCell.shift, selectedCell.role)
                ? "Update"
                : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
