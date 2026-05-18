// src/app/components/schedule-generator.tsx

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Badge } from "@/app/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/app/components/ui/tabs";
import {
  Calendar,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";

interface ShiftAssignment {
  id: string;
  schedule_id?: number;
  shift_id?: number;
  employee_id?: number;
  livestream: string;
  day: string;
  shift: string;
  role: string;
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



const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function ScheduleGenerator({
  currentUser,
  role,
}: ScheduleGeneratorProps) {
  const [livestreams, setLivestreams] = useState<string[]>([]);

  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);

  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  
  const [groupedSchedule, setGroupedSchedule] = useState<any>({});

  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);

  const fetchShiftTemplates = async () => {
    try {
      const res = await fetch(
        "https://thesisprogram-production.up.railway.app/shift-templates"
      );

      const data = await res.json();

      setShiftTemplates(data);
    } catch (err) {
      console.error("Failed to load shift templates", err);
    }
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getWeekDates = (offset: number = 0) => {
    const today = new Date();
    const currentDay = today.getDay() || 7;
    const mondayOffset = currentDay === 1 ? 0 : -(currentDay - 1);
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset + offset * 7);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const getWeekDatesFromAssignments = (assignments: any[]) => {
    if (!assignments || assignments.length === 0) {
      return getWeekDates(0);
    }

    const sortedDates = assignments
      .map((a: any) => a.shift_date)
      .filter(Boolean)
      .sort();

    const firstDate = parseLocalDate(sortedDates[0]);

    const currentDay = firstDate.getDay() || 7;
    const monday = new Date(firstDate);
    monday.setDate(firstDate.getDate() - (currentDay - 1));

    const dates: Date[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  const leaveMap = React.useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();

    approvedLeaves.forEach((leave) => {
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
    return Array.from(new Set(approvedLeaves.map((l) => l.employee)));
  }, [approvedLeaves]);

  const [selectedCell, setSelectedCell] = useState<{
    livestream: string;
    day: string;
    shift: string;
    role: string;
    assignmentId?: string;
  } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [employeeName, setEmployeeName] = useState("");
  const [leaveWeekOffset, setLeaveWeekOffset] = useState(0); // 0 = current week, 1 = next week
  const [weekDates, setWeekDates] = useState<Date[]>(getWeekDates(0));

  useEffect(() => {
    setWeekDates(getWeekDates(leaveWeekOffset));
  }, [leaveWeekOffset]);

  useEffect(() => {
    fetchShiftTemplates();
  }, []);

  useEffect(() => {
    const loadSchedule = async () => {
      try {
        const res = await fetch(
          "https://thesisprogram-production.up.railway.app/generated-schedule",
        );
        const data = await res.json();

        setWeekDates(getWeekDatesFromAssignments(data.assignments || []));

        if (!data.grouped_schedule) return;

        setGroupedSchedule(data.grouped_schedule);
        setLivestreams(Object.keys(data.grouped_schedule));

        const transformed: ShiftAssignment[] = [];

        Object.entries(data.grouped_schedule).forEach(
          ([livestream, days]: any) => {
            Object.entries(days).forEach(([day, shifts]: any) => {
              Object.entries(shifts).forEach(([shift, roles]: any) => {
                Object.entries(roles).forEach(([roleKey, employees]: any) => {
                  (employees || []).forEach((emp: any) => {
                    transformed.push({
                      id: `${livestream}-${day}-${shift}-${roleKey}-${emp.employee_id}`,
                      schedule_id: emp.schedule_id,
                      shift_id: emp.shift_id,
                      employee_id: emp.employee_id,
                      livestream,
                      day,
                      shift,
                      role: roleKey,
                      employee: emp.employee_name,
                    });
                  });
                });
              });
            });
          },
        );

        setAssignments(transformed);
      } catch (err) {
        console.error("Failed to load schedule", err);
      }
    };

    loadSchedule();
  }, []);

  useEffect(() => {
    fetchApprovedLeaves();
  }, [weekDates]);

  const fetchApprovedLeaves = async () => {
    try {
      const start = weekDates[0];
      const end = weekDates[6];

      const res = await fetch(
        `https://thesisprogram-production.up.railway.app/leaves-approved?start=${formatDate(start)}&end=${formatDate(end)}`,
      );

      const data = await res.json();

      const mapped: LeaveRequest[] = data.map((l: any) => ({
        id: `${l.employee_id}-${l.date}`,
        employee: l.employee_name,
        leaveType: l.leave_type,
        startDate: l.date,
        endDate: l.date,
        status: "approved",
        reason: l.reason,
      }));

      setApprovedLeaves(mapped);
    } catch (err) {
      console.error("Failed to fetch leaves", err);
    }
  };

  const isEmployeeOnLeave = (employeeName: string, date: Date) => {
    const dateStr = formatDate(date);
    return approvedLeaves.some((leave) => {
      if (leave.employee !== employeeName) return false;
      return dateStr >= leave.startDate && dateStr <= leave.endDate;
    });
  };

  const getLeavesForDate = (date: Date) => {
    return leaveMap.get(formatDate(date)) || [];
  };

  const getAssignments = (
    livestream: string,
    day: string,
    shift: string,
    role: string,
  ) => {
    return assignments.filter(
      (a) =>
        a.livestream === livestream &&
        a.day === day &&
        a.shift === shift &&
        a.role === role,
    );
  };

  const getAssignment = () => {
    if (!selectedCell?.assignmentId) return null;

    return assignments.find((a) => a.id === selectedCell.assignmentId) || null;
  };

  const openAssignDialog = (
    livestream: string,
    day: string,
    shift: string,
    role: string,
    assignmentId?: string,
  ) => {
    const existing = assignmentId
      ? assignments.find((a) => a.id === assignmentId)
      : null;

    setSelectedCell({ livestream, day, shift, role, assignmentId });
    setEmployeeName(existing?.employee || "");
    setIsDialogOpen(true);
  };

  const handleAssign = () => {
    if (!selectedCell || !employeeName.trim()) {
      toast.error("Please enter an employee name");
      return;
    }

    const existing = getAssignment();

    if (existing) {
      setAssignments(
        assignments.map((a) =>
          a.id === existing.id ? { ...a, employee: employeeName } : a,
        ),
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

    const existing = getAssignment();

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
        const shiftInfo = shiftTemplates.find(
          (s) => s.shift_name === a.shift
        );
        return [
          a.livestream,
          a.day,
          a.shift,
          `${shiftInfo?.start_time || ""} - ${shiftInfo?.end_time || ""}`,
          a.role,
          a.employee,
        ];
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
      const res = await fetch(
        "https://thesisprogram-production.up.railway.app/generate-schedule",
      );
      const data = await res.json();

      setWeekDates(getWeekDatesFromAssignments(data.assignments || []));

      console.log("API RESPONSE:", data);

      if (!res.ok) {
        throw new Error(data.detail || "Failed");
      }

      const grouped = data.grouped_schedule || {};
      setGroupedSchedule(grouped);
      setLivestreams(Object.keys(grouped));
      console.log("GROUPED:", grouped);
      const unfilled = data.unfilled_slots || [];

      //const unfilled: any[] = [];

      const transformed: ShiftAssignment[] = [];

      let idCounter = 0;

      // 🔥 KEEP UI SAME → still loop livestreams
      Object.entries(grouped).forEach(([livestream, days]: any) => {
        DAYS.forEach((day) => {
          const shifts = days[day] || {};

          shiftTemplates.forEach((shift) => {
            const shiftData = shifts[shift.shift_name] || {};

            Object.entries(shiftData).forEach(([roleKey, employees]: any) => {
              (employees || []).forEach((emp: any) => {
                transformed.push({
                  id: String(idCounter++),
                  shift_id: emp.shift_id,
                  employee_id: emp.employee_id,
                  schedule_id: emp.schedule_id,
                  livestream,
                  day,
                  shift: shift.shift_name,
                  role: roleKey,
                  employee: emp.employee_name,
                });
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

  const saveSchedule = async () => {
    try {
      const payload = assignments
        .filter((a) => a.shift_id && a.employee_id)
        .map((a) => {
          const dayIndex = DAYS.indexOf(a.day);

          return {
            shift_id: a.shift_id,

            employee_id: a.employee_id,

            role: a.role.toLowerCase().replace(/\s+/g, "_"),

            shift_date: formatDate(weekDates[dayIndex]),

            shift_type: a.shift,

            account: a.livestream,
          };
        });

      console.log(payload);

      const res = await fetch(
        "https://thesisprogram-production.up.railway.app/save-schedule",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        const err = await res.text();

        console.error(err);

        throw new Error(err);
      }

      toast.success("Schedule saved");
    } catch (err) {
      console.error(err);

      toast.error("Failed to save");
    }
  };

  const getShiftColor = (shift: string) => {
    switch (shift) {
      case "AM":
        return "bg-blue-100 border-blue-300";

      case "NN":
        return "bg-yellow-100 border-yellow-300";

      case "PM":
        return "bg-orange-100 border-orange-300";

      case "GY":
        return "bg-purple-100 border-purple-300";

      default:
        return "bg-gray-100 border-gray-300";
    }
  };

  const getShiftTextColor = (shift: string) => {
    switch (shift) {
      case "AM":
        return "text-blue-700";

      case "NN":
        return "text-yellow-700";

      case "PM":
        return "text-orange-700";

      case "GY":
        return "text-purple-700";

      default:
        return "text-gray-700";
    }
  };

  const getRoleRowsForShift = (livestream: string, shiftName: string) => {
    const roleMaxCounts: Record<string, number> = {};

    DAYS.forEach((day) => {
      const shiftData = groupedSchedule?.[livestream]?.[day]?.[shiftName] || {};

      Object.entries(shiftData).forEach(([roleKey, employees]: any) => {
        const count = Array.isArray(employees) ? employees.length : 0;

        roleMaxCounts[roleKey] = Math.max(
          roleMaxCounts[roleKey] || 1,
          count || 1,
        );
      });
    });

    return Object.entries(roleMaxCounts).flatMap(([roleKey, count]) =>
      Array.from({ length: count }, (_, index) => ({
        roleKey,
        slotIndex: index,
      })),
    );
  };

  const weekLabel = leaveWeekOffset === 0 ? "This Week" : "Next Week";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl">Schedule Generator</h2>
          <p className="text-gray-600">
            Weekly livestream shift allocation and leave management
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="secondary">{role}</Badge>
          {role === "admin" && (
            <>
              <Button onClick={generateSchedule} className="gap-2">
                Generate Schedule
              </Button>

              <Button onClick={saveSchedule} variant="secondary">
                Save Changes
              </Button>
            </>
          )}
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
            {shiftTemplates.map((shift) => (
              <div key={shift.shift_name} className="flex items-center gap-2">
                <div
                  className={`w-10 h-10 rounded border-2 ${getShiftColor(shift.shift_name)} flex items-center justify-center`}
                >
                  <span
                    className={`font-semibold text-xs ${getShiftTextColor(shift.shift_name)}`}
                  >
                    {shift.shift_name}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-medium">{shift.shift_name}</div>
                  <div className="text-xs text-gray-600">{shift.start_time.slice(0,5)} - {shift.end_time.slice(0,5)}</div>
                </div>
              </div>
            ))}
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
          {role === "admin" && (
            <TabsTrigger value="leaves" className="gap-2">
              <CalendarDays className="size-4" />
              Approved Leaves
            </TabsTrigger>
          )}
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
                {livestreams.map((livestream) => (
                  <div key={livestream} className="mb-8">
                    {/* Livestream Header */}
                    <div className="bg-blue-600 text-white p-3 rounded-t-lg">
                      <h3 className="text-lg font-bold text-center">
                        {livestream}
                      </h3>
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
                          {DAYS.map((day, index) => (
                            <th
                              key={day}
                              className="border border-gray-300 bg-gray-100 p-3 text-center font-semibold min-w-[120px]"
                            >
                              <div>{day}</div>
                              <div className="text-xs text-gray-600">
                                {weekDates[index].toLocaleDateString("en-US", {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {shiftTemplates.map((shift) => {
                          const roleRowsForShift = getRoleRowsForShift(
                            livestream,
                            shift.shift_name,
                          );
                          if (roleRowsForShift.length === 0) {
                            return (
                              <tr key={`${livestream}-${shift.shift_name}-empty`}>
                                <td className={`border border-gray-300 p-3 ${getShiftColor(shift.shift_name)}`}>
                                  <div className="font-semibold text-sm">{shift.shift_name}</div>
                                  <div className="text-xs text-gray-600">
                                    {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
                                  </div>
                                </td>
                                <td className="border border-gray-300 bg-gray-50 p-2 text-center text-sm text-gray-400">
                                  No roles
                                </td>
                                {DAYS.map((day) => (
                                  <td
                                    key={`${livestream}-${day}-${shift.shift_name}-empty`}
                                    className="border border-gray-300 p-2 bg-white text-center text-gray-300 text-xs"
                                  >
                                    -
                                  </td>
                                ))}
                              </tr>
                            );
                          }
                          return (
                            <React.Fragment key={`${livestream}-${shift.shift_name}`}>
                              {roleRowsForShift.map(({ roleKey, slotIndex }, roleIndex) => (
                                <tr key={`${livestream}-${shift.shift_name}-${roleKey}-${slotIndex}`}>
                                  {roleIndex === 0 && (
                                    <td
                                      rowSpan={roleRowsForShift.length}
                                      className={`border border-gray-300 p-3 ${getShiftColor(shift.shift_name)}`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-10 h-10 rounded border-2 ${getShiftColor(
                                            shift.shift_name,
                                          )} flex items-center justify-center`}
                                        >
                                          <span
                                            className={`font-semibold text-sm ${getShiftTextColor(
                                              shift.shift_name,
                                            )}`}
                                          >
                                            {shift.shift_name}
                                          </span>
                                        </div>
                                        <div>
                                          <div className="font-semibold text-sm">
                                            {shift.shift_name}
                                          </div>
                                          <div className="text-xs text-gray-600">
                                            {shift.start_time.slice(0, 5)} -{" "}
                                            {shift.end_time.slice(0, 5)}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  )}

                                  <td className="border border-gray-300 bg-gray-50 p-2 text-center font-semibold text-sm capitalize">
                                    {roleKey.replace(/_/g, " ")}
                                  </td>

                                  {DAYS.map((day) => {
                                    const cellAssignment = getAssignments(
                                      livestream,
                                      day,
                                      shift.shift_name,
                                      roleKey,
                                    )[slotIndex];

                                    const isClickable = role === "admin" && !!cellAssignment;

                                    return (
                                      <td
                                        key={`${livestream}-${day}-${shift.shift_name}-${roleKey}-${slotIndex}`}
                                        className={`border border-gray-300 p-2 ${
                                          cellAssignment ? getShiftColor(shift.shift_name) : "bg-white"
                                        } ${isClickable ? "cursor-pointer hover:bg-gray-100" : ""}`}
                                        onClick={() =>
                                          isClickable &&
                                          openAssignDialog(
                                            livestream,
                                            day,
                                            shift.shift_name,
                                            roleKey,
                                            cellAssignment?.id,
                                          )
                                        }
                                      >
                                        {cellAssignment ? (
                                          <div className="text-center">
                                            <div
                                              className={`font-medium text-sm ${getShiftTextColor(
                                                shift.shift_name,
                                              )}`}
                                            >
                                              {cellAssignment.employee}
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
                              ))}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approved Leaves Tab */}
        {role === "admin" && (
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
                              {date.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Get unique employees from approved leaves */}
                      {uniqueEmployeesOnLeave.map((employee) => {
                        const hasLeaveThisWeek = weekDates.some((date) => {
                          const leaves = getLeavesForDate(date);
                          return leaves.some((l) => l.employee === employee);
                        });
                        if (!hasLeaveThisWeek) return null;

                        return (
                          <tr key={employee}>
                            <td className="border border-gray-300 p-3 font-medium">
                              {employee}
                            </td>
                            {weekDates.map((date, index) => {
                              const leaves = getLeavesForDate(date);
                              const leave = leaves.find(
                                (l) => l.employee === employee,
                              );
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
                                      <Badge
                                        variant="destructive"
                                        className="text-xs"
                                      >
                                        {leave.leaveType}
                                      </Badge>
                                      <div className="text-xs text-gray-600 mt-1">
                                        {leave.reason}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-center text-gray-300 text-xs py-1">
                                      -
                                    </div>
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
                  {!approvedLeaves.some((leave) =>
                    weekDates.some(
                      (date) => formatDate(date) === leave.startDate,
                    ),
                  ) && (
                    <div className="text-center py-8 text-gray-500">
                      No approved leaves for {weekLabel.toLowerCase()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Assignment Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedCell &&
              getAssignment()
                ? "Modify Assignment"
                : "Assign Shift"}
            </DialogTitle>
            <DialogDescription>
              {selectedCell && (
                <div className="space-y-1 mt-2">
                  <div>
                    <strong>Livestream:</strong> {selectedCell.livestream}
                  </div>
                  <div>
                    <strong>Day:</strong> {selectedCell.day}
                  </div>
                  <div>
                    <strong>Shift:</strong>{" "}
                    {
                      shiftTemplates.find(
                        (s) => s.shift_name === selectedCell.shift
                      )?.shift_name
                    }
                    {" ("}
                    {
                      shiftTemplates.find(
                        (s) => s.shift_name === selectedCell.shift
                      )?.start_time?.slice(0, 5)
                    }
                    {" - "}
                    {
                      shiftTemplates.find(
                        (s) => s.shift_name === selectedCell.shift
                      )?.end_time?.slice(0, 5)
                    }
                    {")"}
                  </div>
                  <div>
                    <strong>Role:</strong> {selectedCell.role}
                  </div>
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
            {selectedCell &&
              getAssignment() && (
                <Button
                  variant="destructive"
                  onClick={handleRemove}
                  className="gap-2"
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              )}
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign}>
              {selectedCell &&
              getAssignment()
                ? "Update"
                : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
