// ---------------------------------------------------
// src/app/components/schedule-generator.tsx

import React, { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
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
  shift_template_id?: number;
  color_index?: number | null;
  employee_id?: number | null;
  livestream: string;
  day: string;
  shift: string;
  role: string;
  employee: string;
  slot_index?: number;
  is_absent?: boolean;
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

interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface ScheduleGeneratorProps {
  currentUser: string;
  currentUserId: number;
  role: string;
  companyId: number | null;
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

type ShiftColorClasses = {
  surface: string;
  marker: string;
  text: string;
};

const DEFAULT_SHIFT_COLOR_CLASSES: ShiftColorClasses = {
  surface: "bg-gray-50 border-gray-300",
  marker: "bg-gray-100 border-gray-500",
  text: "text-gray-700",
};

const SHIFT_COLOR_PALETTE: ShiftColorClasses[] = [
  {
    surface: "bg-blue-50 border-blue-300",
    marker: "bg-blue-100 border-blue-500",
    text: "text-blue-700",
  },
  {
    surface: "bg-emerald-50 border-emerald-300",
    marker: "bg-emerald-100 border-emerald-500",
    text: "text-emerald-700",
  },
  {
    surface: "bg-orange-50 border-orange-300",
    marker: "bg-orange-100 border-orange-500",
    text: "text-orange-700",
  },
  {
    surface: "bg-purple-50 border-purple-300",
    marker: "bg-purple-100 border-purple-500",
    text: "text-purple-700",
  },
  {
    surface: "bg-pink-50 border-pink-300",
    marker: "bg-pink-100 border-pink-500",
    text: "text-pink-700",
  },
  {
    surface: "bg-cyan-50 border-cyan-300",
    marker: "bg-cyan-100 border-cyan-500",
    text: "text-cyan-700",
  },
  {
    surface: "bg-lime-50 border-lime-300",
    marker: "bg-lime-100 border-lime-500",
    text: "text-lime-700",
  },
  {
    surface: "bg-amber-50 border-amber-300",
    marker: "bg-amber-100 border-amber-500",
    text: "text-amber-700",
  },
  {
    surface: "bg-rose-50 border-rose-300",
    marker: "bg-rose-100 border-rose-500",
    text: "text-rose-700",
  },
  {
    surface: "bg-indigo-50 border-indigo-300",
    marker: "bg-indigo-100 border-indigo-500",
    text: "text-indigo-700",
  },
  {
    surface: "bg-teal-50 border-teal-300",
    marker: "bg-teal-100 border-teal-500",
    text: "text-teal-700",
  },
  {
    surface: "bg-yellow-50 border-yellow-300",
    marker: "bg-yellow-100 border-yellow-500",
    text: "text-yellow-700",
  },
  {
    surface: "bg-fuchsia-50 border-fuchsia-300",
    marker: "bg-fuchsia-100 border-fuchsia-500",
    text: "text-fuchsia-700",
  },
  {
    surface: "bg-sky-50 border-sky-300",
    marker: "bg-sky-100 border-sky-500",
    text: "text-sky-700",
  },
  {
    surface: "bg-violet-50 border-violet-300",
    marker: "bg-violet-100 border-violet-500",
    text: "text-violet-700",
  },
  {
    surface: "bg-red-50 border-red-300",
    marker: "bg-red-100 border-red-500",
    text: "text-red-700",
  },
  {
    surface: "bg-green-50 border-green-300",
    marker: "bg-green-100 border-green-500",
    text: "text-green-700",
  },
  {
    surface: "bg-blue-100 border-blue-400",
    marker: "bg-blue-50 border-blue-600",
    text: "text-blue-800",
  },
  {
    surface: "bg-emerald-100 border-emerald-400",
    marker: "bg-emerald-50 border-emerald-600",
    text: "text-emerald-800",
  },
  {
    surface: "bg-orange-100 border-orange-400",
    marker: "bg-orange-50 border-orange-600",
    text: "text-orange-800",
  },
  {
    surface: "bg-purple-100 border-purple-400",
    marker: "bg-purple-50 border-purple-600",
    text: "text-purple-800",
  },
  {
    surface: "bg-pink-100 border-pink-400",
    marker: "bg-pink-50 border-pink-600",
    text: "text-pink-800",
  },
  {
    surface: "bg-cyan-100 border-cyan-400",
    marker: "bg-cyan-50 border-cyan-600",
    text: "text-cyan-800",
  },
  {
    surface: "bg-lime-100 border-lime-400",
    marker: "bg-lime-50 border-lime-600",
    text: "text-lime-800",
  },
  {
    surface: "bg-amber-100 border-amber-400",
    marker: "bg-amber-50 border-amber-600",
    text: "text-amber-800",
  },
  {
    surface: "bg-rose-100 border-rose-400",
    marker: "bg-rose-50 border-rose-600",
    text: "text-rose-800",
  },
  {
    surface: "bg-indigo-100 border-indigo-400",
    marker: "bg-indigo-50 border-indigo-600",
    text: "text-indigo-800",
  },
  {
    surface: "bg-teal-100 border-teal-400",
    marker: "bg-teal-50 border-teal-600",
    text: "text-teal-800",
  },
  {
    surface: "bg-yellow-100 border-yellow-400",
    marker: "bg-yellow-50 border-yellow-600",
    text: "text-yellow-800",
  },
  {
    surface: "bg-fuchsia-100 border-fuchsia-400",
    marker: "bg-fuchsia-50 border-fuchsia-600",
    text: "text-fuchsia-800",
  },
];

export function ScheduleGenerator({
  currentUser,
  currentUserId,
  role,
  companyId,
}: ScheduleGeneratorProps) {
  const [livestreams, setLivestreams] = useState<string[]>([]);

  const [accountOrder, setAccountOrder] = useState<string[]>([]);

  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);

  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);

  const [staffingRequirements, setStaffingRequirements] = useState<any[]>([]);

  const [scheduleMode, setScheduleMode] = useState<"saved" | "preview">(
    "saved",
  );

  const [groupedSchedule, setGroupedSchedule] = useState<any>({});

  const [approvedLeaves, setApprovedLeaves] = useState<LeaveRequest[]>([]);

  const [employees, setEmployees] = useState<Employee[]>([]);

  const fetchShiftTemplates = async () => {
    try {
      if (!companyId) return;

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/shift-templates?company_id=${companyId}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load shift templates");
      }

      setShiftTemplates(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load shift templates", err);
    }
  };

  const fetchStaffingRequirements = async () => {
    try {
      if (!companyId) return;

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/staffing-requirements?company_id=${companyId}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load staffing requirements");
      }

      setStaffingRequirements(data.requirements || []);
    } catch (err) {
      console.error("Failed to load staffing requirements", err);
    }
  };

  const fetchAccounts = async () => {
    try {
      if (!companyId) return;

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/accounts?company_id=${companyId}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load accounts");
      }

      if (!Array.isArray(data)) {
        throw new Error("Invalid accounts response");
      }

      setAccountOrder(data.map((account: any) => account.name));
    } catch (err) {
      console.error("Failed to load accounts", err);
    }
  };

  const fetchEmployees = async () => {
    try {
      if (!companyId) return;

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/employees?company_id=${companyId}`,
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to load employees");
      }

      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load employees", err);
    }
  };

  const finalizeCompletedSchedules = async () => {
    try {
      if (!companyId) return;

      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/finalize-completed-schedules",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            company_id: companyId,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.detail || "Failed to finalize completed schedules",
        );
      }

      if (data.finalized_count > 0) {
        console.log("Finalized completed schedules:", data.finalized_count);
      }
    } catch (err) {
      console.error("Failed to finalize completed schedules", err);
    }
  };

  const getOrderedLivestreams = (grouped: any) => {
    const groupedKeys = Object.keys(grouped || {});

    const ordered = accountOrder.filter((account) =>
      groupedKeys.includes(account),
    );

    const remaining = groupedKeys.filter(
      (account) => !ordered.includes(account),
    );

    return [...ordered, ...remaining];
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [scheduleWeekOffset, setScheduleWeekOffset] = useState<0 | 1>(0);
  const [weekDates, setWeekDates] = useState<Date[]>(getWeekDates(0));
  const selectedWeekDates = getWeekDates(scheduleWeekOffset);
  const selectedWeekStart = formatDate(selectedWeekDates[0]);
  const selectedWeekEnd = formatDate(selectedWeekDates[6]);

  useEffect(() => {
    setWeekDates(getWeekDates(scheduleWeekOffset));
    setScheduleMode("saved");
  }, [scheduleWeekOffset]);

  useEffect(() => {
    if (!companyId) return;

    const initializeSchedulePage = async () => {
      await finalizeCompletedSchedules();

      fetchShiftTemplates();
      fetchStaffingRequirements();
      fetchAccounts();
      fetchEmployees();
    };

    initializeSchedulePage();
  }, [companyId]);

  const loadSchedule = async () => {
    try {
      const dates = getWeekDates(scheduleWeekOffset);
      const weekStart = formatDate(dates[0]);
      const weekEnd = formatDate(dates[6]);

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/generated-schedule?company_id=${companyId}&week_start=${weekStart}&week_end=${weekEnd}`,
      );

      const data = await res.json();

      setWeekDates(dates);

      if (!data.grouped_schedule) return;

      setGroupedSchedule(data.grouped_schedule);
      setLivestreams(getOrderedLivestreams(data.grouped_schedule));

      const transformed: ShiftAssignment[] = [];

      Object.entries(data.grouped_schedule).forEach(
        ([livestream, days]: any) => {
          Object.entries(days).forEach(([day, shifts]: any) => {
            Object.entries(shifts).forEach(([shift, roles]: any) => {
              Object.entries(roles).forEach(([roleKey, employees]: any) => {
                (employees || []).forEach((emp: any, index: number) => {
                  transformed.push({
                    id: `${livestream}-${day}-${shift}-${roleKey}-${emp.schedule_id || emp.employee_id}`,
                    schedule_id: emp.schedule_id,
                    shift_id: emp.shift_id,
                    shift_template_id: emp.shift_template_id,
                    color_index: emp.color_index ?? null,
                    employee_id: emp.employee_id,
                    livestream,
                    day,
                    shift,
                    role: roleKey,
                    employee: emp.employee_name,
                    slot_index: emp.slot_index ?? index,
                    is_absent: Boolean(emp.is_absent),
                  });
                });
              });
            });
          });
        },
      );

      setAssignments(transformed);
      setScheduleMode("saved");
    } catch (err) {
      console.error("Failed to load schedule", err);
    }
  };

  useEffect(() => {
    if (accountOrder.length > 0) {
      loadSchedule();
    }
  }, [accountOrder, scheduleWeekOffset]);

  useEffect(() => {
    if (!companyId) return;

    fetchApprovedLeaves();
  }, [weekDates, companyId]);

  const fetchApprovedLeaves = async () => {
    try {
      const start = weekDates[0];
      const end = weekDates[6];

      if (!companyId) return;

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/leaves-approved?company_id=${companyId}&start=${formatDate(start)}&end=${formatDate(end)}`,
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

  const getShiftIdForCell = (
    livestream: string,
    day: string,
    shift: string,
  ) => {
    return (
      assignments.find(
        (a) =>
          a.livestream === livestream &&
          a.day === day &&
          a.shift === shift &&
          a.shift_id,
      )?.shift_id ||
      assignments.find(
        (a) => a.livestream === livestream && a.shift === shift && a.shift_id,
      )?.shift_id ||
      null
    );
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
    setSelectedEmployeeId(
      existing?.employee_id ? String(existing.employee_id) : "",
    );
    setIsDialogOpen(true);
  };

  const updatePublishedAssignment = async (
    scheduleId: number,
    employeeId: number | null,
  ) => {
    const res = await fetch(
      `https://backend-production-6e75.up.railway.app/generated-schedule/${scheduleId}/employee`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: companyId,
          employee_id: employeeId,
          updated_by: currentUserId,
        }),
      },
    );

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      if (
        data?.detail?.type === "MANUAL_ASSIGNMENT_BLOCKED" &&
        Array.isArray(data.detail.errors)
      ) {
        throw new Error(data.detail.errors.join("\n"));
      }

      if (data?.detail?.type === "MANUAL_ASSIGNMENT_REQUEST_ALREADY_EXISTS") {
        throw new Error(
          data.detail.message ||
            "A pending assignment request already exists for this employee and shift.",
        );
      }

      const message =
        typeof data?.detail === "string"
          ? data.detail
          : data?.detail?.message || "Failed to update assignment";

      throw new Error(message);
    }

    return data;
  };

  const markPublishedAssignmentAbsent = async (scheduleId: number) => {
    const res = await fetch(
      `https://backend-production-6e75.up.railway.app/generated-schedule/${scheduleId}/mark-absent`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company_id: companyId,
          marked_by: currentUserId,
        }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Failed to mark absent");
    }

    return data;
  };

  const handleMarkAbsent = async () => {
    const existing = getAssignment();

    if (!existing?.schedule_id || !existing.employee_id) {
      toast.error("No assigned employee selected");
      return;
    }

    if (existing.is_absent) {
      toast.info("Employee is already marked absent");
      return;
    }

    if (scheduleWeekOffset !== 0 || scheduleMode !== "saved") {
      toast.error("Only this week's published schedule can be marked absent");
      return;
    }

    const confirmed = window.confirm(
      `Mark ${existing.employee} as absent for this shift? This will record an uninformed absence and keep the employee visible in the schedule.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await markPublishedAssignmentAbsent(existing.schedule_id);

      toast.success("Employee marked as absent");

      await loadSchedule();

      setIsDialogOpen(false);
      setEmployeeName("");
      setSelectedEmployeeId("");
      setSelectedCell(null);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to mark absent");
    }
  };

  const handleAssign = async () => {
    if (!selectedCell || !selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }

    const selectedEmployee = employees.find(
      (emp) => emp.id === Number(selectedEmployeeId),
    );

    if (!selectedEmployee) {
      toast.error("Selected employee not found");
      return;
    }

    const existing = getAssignment();

    if (scheduleMode === "saved" && existing?.schedule_id) {
      try {
        const result = await updatePublishedAssignment(
          existing.schedule_id,
          selectedEmployee.id,
        );

        if (result?.requires_employee_approval) {
          toast.info(
            "Assignment request sent. The employee must approve before the schedule changes.",
          );

          await loadSchedule();

          setIsDialogOpen(false);
          setEmployeeName("");
          setSelectedEmployeeId("");
          setSelectedCell(null);
          return;
        }

        setAssignments(
          assignments.map((a) =>
            a.id === existing.id
              ? {
                  ...a,
                  employee_id: selectedEmployee.id,
                  employee: selectedEmployee.name,
                  is_absent: false,
                }
              : a,
          ),
        );

        toast.success("Assignment updated");
        setIsDialogOpen(false);
        setEmployeeName("");
        setSelectedEmployeeId("");
        setSelectedCell(null);
        return;
      } catch (err) {
        console.error(err);

        toast.error(
          err instanceof Error ? err.message : "Failed to update assignment",
        );

        return;
      }
    }

    if (existing) {
      setAssignments(
        assignments.map((a) =>
          a.id === existing.id
            ? {
                ...a,
                employee_id: selectedEmployee.id,
                employee: selectedEmployee.name,
                is_absent: false,
              }
            : a,
        ),
      );

      toast.success("Shift updated successfully");
    } else {
      const shiftId = getShiftIdForCell(
        selectedCell.livestream,
        selectedCell.day,
        selectedCell.shift,
      );

      if (!shiftId) {
        toast.error(
          "Cannot assign this empty slot because shift ID is missing",
        );
        return;
      }

      const newAssignment: ShiftAssignment = {
        id: Date.now().toString(),
        shift_id: shiftId,
        employee_id: selectedEmployee.id,
        livestream: selectedCell.livestream,
        day: selectedCell.day,
        shift: selectedCell.shift,
        role: selectedCell.role,
        employee: selectedEmployee.name,
        slot_index: getAssignments(
          selectedCell.livestream,
          selectedCell.day,
          selectedCell.shift,
          selectedCell.role,
        ).length,
      };

      setAssignments([...assignments, newAssignment]);

      toast.success("Shift assigned successfully");
    }

    setScheduleMode("preview");
    setIsDialogOpen(false);
    setEmployeeName("");
    setSelectedEmployeeId("");
    setSelectedCell(null);
  };

  const handleRemove = async () => {
    if (!selectedCell) return;

    const existing = getAssignment();

    if (scheduleMode === "saved" && existing?.schedule_id) {
      try {
        await updatePublishedAssignment(existing.schedule_id, null);

        setAssignments(
          assignments.map((a) =>
            a.id === existing.id
              ? {
                  ...a,
                  employee_id: null,
                  employee: "",
                  is_absent: false,
                }
              : a,
          ),
        );

        toast.success("This week's assignment removed");
        setIsDialogOpen(false);
        setEmployeeName("");
        setSelectedEmployeeId("");
        setSelectedCell(null);
        return;
      } catch (err) {
        console.error(err);
        toast.error("Failed to remove this week's assignment");
        return;
      }
    }

    if (existing) {
      setAssignments(
        assignments.map((a) =>
          a.id === existing.id
            ? {
                ...a,
                employee_id: null,
                employee: "",
                is_absent: false,
              }
            : a,
        ),
      );

      setScheduleMode("preview");
      toast.success("Assignment removed");
    }

    setIsDialogOpen(false);
    setEmployeeName("");
    setSelectedEmployeeId("");
    setSelectedCell(null);
  };

  const exportSchedule = () => {
    const csv = [
      ["Livestream", "Day", "Shift", "Time", "Role", "Employee"],
      ...assignments.map((a) => {
        const shiftInfo = shiftTemplates.find((s) => s.shift_name === a.shift);
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

  const normalizeKey = (value: any) =>
    String(value || "")
      .trim()
      .toLowerCase();

  const getShiftTemplatesForAccount = (livestream: string) => {
    const accountKey = normalizeKey(livestream);

    return shiftTemplates
      .filter((shift) => normalizeKey(shift.account_name) === accountKey)
      .sort((a, b) => {
        const aTime = String(a.start_time || "00:00:00");
        const bTime = String(b.start_time || "00:00:00");

        if (aTime !== bTime) return aTime.localeCompare(bTime);

        return String(a.shift_name || "").localeCompare(
          String(b.shift_name || ""),
        );
      });
  };

  const getShiftTemplateForAccount = (
    livestream: string,
    shiftName: string,
  ) => {
    return shiftTemplates.find(
      (shift) =>
        normalizeKey(shift.account_name) === normalizeKey(livestream) &&
        normalizeKey(shift.shift_name) === normalizeKey(shiftName),
    );
  };

  const generateSchedule = async () => {
    if (scheduleWeekOffset !== 1) {
      toast.error("Switch to Next Week before generating a new schedule.");
      return;
    }

    try {
      const dates = getWeekDates(1);
      const weekStart = formatDate(dates[0]);
      const weekEnd = formatDate(dates[6]);

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/generate-schedule?company_id=${companyId}&week_start=${weekStart}&week_end=${weekEnd}`,
      );
      const data = await res.json();

      setWeekDates(dates);

      console.log("API RESPONSE:", data);

      if (!res.ok) {
        throw new Error(data.detail || "Failed");
      }

      const grouped = data.grouped_schedule || {};
      setGroupedSchedule(grouped);
      setLivestreams(getOrderedLivestreams(grouped));
      console.log("GROUPED:", grouped);
      const unfilled = data.unfilled_slots || [];

      //const unfilled: any[] = [];

      const transformed: ShiftAssignment[] = [];

      let idCounter = 0;

      // 🔥 KEEP UI SAME → still loop livestreams
      Object.entries(grouped).forEach(([livestream, days]: any) => {
        DAYS.forEach((day) => {
          const shifts = days[day] || {};

          getShiftTemplatesForAccount(livestream).forEach((shift) => {
            const shiftData = shifts[shift.shift_name] || {};

            Object.entries(shiftData).forEach(([roleKey, employees]: any) => {
              (employees || []).forEach((emp: any, index: number) => {
                transformed.push({
                  id: String(idCounter++),
                  shift_id: emp.shift_id,
                  shift_template_id:
                    emp.shift_template_id ?? shift.shift_template_id,
                  color_index: emp.color_index ?? shift.color_index ?? null,
                  employee_id: emp.employee_id,
                  schedule_id: emp.schedule_id,
                  livestream,
                  day,
                  shift: shift.shift_name,
                  role: roleKey,
                  employee: emp.employee_name,
                  slot_index: emp.slot_index ?? index,
                  is_absent: Boolean(emp.is_absent),
                });
              });
            });
          });
        });
      });

      setAssignments([...transformed]);
      setScheduleMode("preview");

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
    if (scheduleMode !== "preview") {
      toast.error("Generate a new schedule first before saving changes");
      return;
    }
    try {
      const payload = livestreams.flatMap((livestream) =>
        getVisibleShifts(livestream).flatMap((shift) =>
          getRoleRowsForShift(livestream, shift.shift_name).flatMap(
            ({ roleKey, slotIndex }) =>
              DAYS.flatMap((day) => {
                const dayIndex = DAYS.indexOf(day);

                const cellAssignment = getAssignments(
                  livestream,
                  day,
                  shift.shift_name,
                  roleKey,
                ).find((a) => (a.slot_index ?? 0) === slotIndex);

                const shiftId =
                  cellAssignment?.shift_id ||
                  getShiftIdForCell(livestream, day, shift.shift_name);

                if (!shiftId) {
                  return [];
                }

                return [
                  {
                    shift_id: shiftId,

                    employee_id: cellAssignment?.employee_id ?? null,

                    role: roleKey.toLowerCase().replace(/\s+/g, "_"),

                    shift_date: formatDate(weekDates[dayIndex]),

                    shift_type: shift.shift_name,

                    account: livestream,

                    slot_index: slotIndex,
                  },
                ];
              }),
          ),
        ),
      );

      console.log(payload);

      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/save-schedule",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignments: payload,
            saved_by: currentUserId,
            company_id: companyId,
            week_start: selectedWeekStart,
            week_end: selectedWeekEnd,
            force_republish_current_week: false,
          }),
        },
      );

      if (!res.ok) {
        const err = await res.text();

        console.error(err);

        throw new Error(err);
      }

      toast.success("Schedule saved");
      await loadSchedule();
    } catch (err) {
      console.error(err);

      toast.error("Failed to save");
    }
  };

  const getShiftColorClasses = (colorIndex?: number | null) => {
    const parsedColorIndex = Number(colorIndex);

    if (
      !Number.isInteger(parsedColorIndex) ||
      parsedColorIndex < 1 ||
      parsedColorIndex > SHIFT_COLOR_PALETTE.length
    ) {
      return DEFAULT_SHIFT_COLOR_CLASSES;
    }

    return SHIFT_COLOR_PALETTE[parsedColorIndex - 1];
  };

  const formatShiftTime = (value: any) => {
    return String(value || "").slice(0, 5);
  };

  const getShiftTimeRangeKey = (shift: any) => {
    const startTime = formatShiftTime(shift?.start_time);
    const endTime = formatShiftTime(shift?.end_time);

    if (!startTime || !endTime) {
      return "";
    }

    return `${startTime}|${endTime}`;
  };

  const getGroupedShiftLegendItems = () => {
    const groups = new Map<
      string,
      {
        key: string;
        start_time: string;
        end_time: string;
        color_index: number | null;
        shift_names: Set<string>;
      }
    >();

    shiftTemplates.forEach((shift) => {
      const key = getShiftTimeRangeKey(shift);

      if (!key) {
        return;
      }

      if (!groups.has(key)) {
        groups.set(key, {
          key,
          start_time: formatShiftTime(shift.start_time),
          end_time: formatShiftTime(shift.end_time),
          color_index: shift.color_index ?? null,
          shift_names: new Set<string>(),
        });
      }

      const group = groups.get(key);

      if (!group) {
        return;
      }

      if (group.color_index === null && shift.color_index !== null) {
        group.color_index = shift.color_index;
      }

      if (shift.shift_name) {
        group.shift_names.add(String(shift.shift_name).trim());
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        shift_names: Array.from(group.shift_names).sort(),
      }))
      .sort((a, b) => {
        if (a.start_time !== b.start_time) {
          return a.start_time.localeCompare(b.start_time);
        }

        return a.end_time.localeCompare(b.end_time);
      });
  };

  const getVisibleShifts = (livestream: string) => {
    const accountShifts = getShiftTemplatesForAccount(livestream);

    if (accountShifts.length > 0) {
      return accountShifts;
    }

    const savedShiftNames = Array.from(
      new Set(
        assignments
          .filter((a) => a.livestream === livestream)
          .map((a) => a.shift),
      ),
    );

    return savedShiftNames.map((shiftName) => {
      const assignment = assignments.find(
        (a) => a.livestream === livestream && a.shift === shiftName,
      );

      return {
        shift_name: shiftName,
        start_time: "",
        end_time: "",
        color_index: assignment?.color_index ?? null,
      };
    });
  };

  const getRoleRowsForShift = (livestream: string, shiftName: string) => {
    const shiftTemplate = getShiftTemplateForAccount(livestream, shiftName);

    if (shiftTemplate) {
      const shiftTemplateId = Number(shiftTemplate.shift_template_id);

      const rowsFromRequirements = staffingRequirements
        .filter(
          (req) =>
            Number(req.shift_template_id) === shiftTemplateId &&
            String(req.account_name || "").toLowerCase() ===
              String(livestream || "").toLowerCase() &&
            Number(req.required_count) > 0,
        )
        .flatMap((req) =>
          Array.from({ length: Number(req.required_count) }, (_, index) => ({
            roleKey: req.role_key,
            slotIndex: index,
          })),
        );

      if (rowsFromRequirements.length > 0) {
        return rowsFromRequirements;
      }
    }

    const roleCounts: Record<string, number> = {};

    DAYS.forEach((day) => {
      assignments
        .filter(
          (a) =>
            a.livestream === livestream &&
            a.day === day &&
            a.shift === shiftName,
        )
        .forEach((a) => {
          roleCounts[a.role] = Math.max(
            roleCounts[a.role] || 0,
            (a.slot_index ?? 0) + 1,
          );
        });
    });

    return Object.entries(roleCounts).flatMap(([roleKey, count]) =>
      Array.from({ length: count }, (_, index) => ({
        roleKey,
        slotIndex: index,
      })),
    );
  };

  const weekLabel = scheduleWeekOffset === 0 ? "This Week" : "Next Week";

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
          <Select
            value={String(scheduleWeekOffset)}
            onValueChange={(value) =>
              setScheduleWeekOffset(Number(value) as 0 | 1)
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Select week" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="0">This Week</SelectItem>
              <SelectItem value="1">Next Week</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary">{role}</Badge>
          {role === "admin" && (
            <>
              <Button
                onClick={generateSchedule}
                className="gap-2"
                disabled={scheduleWeekOffset !== 1}
              >
                Generate Schedule
              </Button>
              <Button
                onClick={saveSchedule}
                variant="secondary"
                disabled={scheduleMode !== "preview"}
              >
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
          <div className="flex flex-wrap items-start justify-start gap-x-10 gap-y-4">
            {getGroupedShiftLegendItems().map((shiftGroup) => {
              const shiftColor = getShiftColorClasses(shiftGroup.color_index);

              return (
                <div
                  key={shiftGroup.key}
                  className="flex items-center gap-2 min-w-[130px] max-w-[260px]"
                >
                  <div
                    className={`w-10 h-10 shrink-0 rounded border-2 ${shiftColor.marker}`}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">
                      {shiftGroup.shift_names.join(" / ") || "Shift"}
                    </div>
                    <div className="text-xs text-gray-600">
                      {shiftGroup.start_time} - {shiftGroup.end_time}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      {/* Main Tabs */}
      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList
          className={
            role === "admin"
              ? "grid w-full max-w-md grid-cols-2"
              : "inline-flex w-fit"
          }
        >
          <TabsTrigger value="schedule" className="gap-2 px-12">
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
                        {getVisibleShifts(livestream).map((shift) => {
                          const roleRowsForShift = getRoleRowsForShift(
                            livestream,
                            shift.shift_name,
                          );
                          if (roleRowsForShift.length === 0) {
                            return (
                              <tr
                                key={`${livestream}-${shift.shift_name}-empty`}
                              >
                                <td
                                  className={`border border-gray-300 p-3 ${getShiftColorClasses(shift.color_index).surface}`}
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <div
                                      className={`w-8 h-8 shrink-0 rounded border-2 ${getShiftColorClasses(shift.color_index).marker}`}
                                    />
                                    <div className="min-w-0">
                                      <div className="font-semibold text-sm truncate">
                                        {shift.shift_name}
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        {shift.start_time.slice(0, 5)} -{" "}
                                        {shift.end_time.slice(0, 5)}
                                      </div>
                                    </div>
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
                            <React.Fragment
                              key={`${livestream}-${shift.shift_name}`}
                            >
                              {roleRowsForShift.map(
                                ({ roleKey, slotIndex }, roleIndex) => (
                                  <tr
                                    key={`${livestream}-${shift.shift_name}-${roleKey}-${slotIndex}`}
                                  >
                                    {roleIndex === 0 && (
                                      <td
                                        rowSpan={roleRowsForShift.length}
                                        className={`border border-gray-300 p-3 ${getShiftColorClasses(shift.color_index).surface}`}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <div
                                            className={`w-10 h-10 shrink-0 rounded border-2 ${getShiftColorClasses(shift.color_index).marker}`}
                                          />
                                          <div className="min-w-0">
                                            <div className="font-semibold text-sm truncate">
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
                                      const roleAssignments = getAssignments(
                                        livestream,
                                        day,
                                        shift.shift_name,
                                        roleKey,
                                      );

                                      const cellAssignment =
                                        roleAssignments.find(
                                          (a) =>
                                            (a.slot_index ?? 0) === slotIndex,
                                        );

                                      const isClickable = role === "admin";
                                      const isAbsent = Boolean(
                                        cellAssignment?.is_absent,
                                      );

                                      return (
                                        <td
                                          key={`${livestream}-${day}-${shift.shift_name}-${roleKey}-${slotIndex}`}
                                          className={`border border-gray-300 p-2 ${
                                            cellAssignment?.employee_id
                                              ? isAbsent
                                                ? "bg-gray-200 text-gray-500"
                                                : getShiftColorClasses(
                                                    shift.color_index,
                                                  ).surface
                                              : "bg-white text-gray-300"
                                          } ${
                                            isClickable &&
                                            cellAssignment?.employee_id
                                              ? "cursor-pointer hover:bg-gray-100"
                                              : isClickable
                                                ? "cursor-pointer hover:bg-white"
                                                : ""
                                          }`}
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
                                          {cellAssignment?.employee_id ? (
                                            <div className="text-center">
                                              <div
                                                className={`font-medium text-sm ${
                                                  isAbsent
                                                    ? "text-gray-500 line-through"
                                                    : getShiftColorClasses(
                                                        shift.color_index,
                                                      ).text
                                                }`}
                                              >
                                                {cellAssignment.employee}
                                              </div>

                                              {isAbsent && (
                                                <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                                  Absent
                                                </div>
                                              )}
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
                                ),
                              )}
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
                      onClick={() => setScheduleWeekOffset(0)}
                      disabled={scheduleWeekOffset === 0}
                      className="gap-2"
                    >
                      <ChevronLeft className="size-4" />
                      This Week
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setScheduleWeekOffset(1)}
                      disabled={scheduleWeekOffset === 1}
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
              {selectedCell && getAssignment()?.employee_id
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
                        (s) => s.shift_name === selectedCell.shift,
                      )?.shift_name
                    }
                    {" ("}
                    {shiftTemplates
                      .find((s) => s.shift_name === selectedCell.shift)
                      ?.start_time?.slice(0, 5)}
                    {" - "}
                    {shiftTemplates
                      .find((s) => s.shift_name === selectedCell.shift)
                      ?.end_time?.slice(0, 5)}
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
              <Label>Employee Name</Label>

              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>

                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {selectedCell &&
              getAssignment()?.employee_id &&
              scheduleWeekOffset === 0 &&
              scheduleMode === "saved" &&
              !getAssignment()?.is_absent && (
                <Button
                  variant="secondary"
                  onClick={handleMarkAbsent}
                  className="gap-2"
                >
                  Mark as Absent
                </Button>
              )}

            {selectedCell && getAssignment()?.employee_id && (
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
              {selectedCell && getAssignment()?.employee_id
                ? "Update"
                : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
