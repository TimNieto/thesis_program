// ---------------------------------------------------
// src/app/components/cover-application.tsx

import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
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
import { Label } from "@/app/components/ui/label";
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
import { Calendar } from "@/app/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Calendar as CalendarIcon,
  Plane,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

interface ShiftApplication {
  id: string;
  coverage_request_id?: string;
  employee_id?: number;
  applicant: string;
  livestream: string;
  day: string;
  shift: string;
  role: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  appliedAt: string;
}

interface CoverRequest {
  id: string;
  schedule_id?: number;
  requested_by?: number;
  requester: string;
  livestream: string;
  day: string;
  shift: string;
  role: string;
  reason: string;

  status: "pending" | "approved" | "denied";

  request_type: "normal" | "emergency";

  is_targeted: boolean;

  submittedAt: string;
}

interface LeaveRequest {
  id: string;
  requester: string;
  livestream: string;
  day: string;
  shift: string;
  role: string;
  leaveType: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
}

interface CoverApplicationProps {
  currentUser: {
    employee_id: number;
    name: string;
    company_id: number | null;
  };
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

const LEAVE_TYPES = [
  "Sick Leave",
  "Vacation",
  "Personal",
  "Emergency",
  "Other",
];

export function CoverApplication({ currentUser, role }: CoverApplicationProps) {
  const [applications, setApplications] = useState<ShiftApplication[]>([]);
  const [shiftTemplates, setShiftTemplates] = useState<any[]>([]);
  const [coverRequests, setCoverRequests] = useState<CoverRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [myShifts, setMyShifts] = useState<any[]>([]);
  const [absenceReplacementMode, setAbsenceReplacementMode] = useState<string>("Manual");

  const employeesMap = Object.fromEntries(
    employees.map((emp) => [emp.id, emp.name]),
  );

  const fetchMyLeaves = async () => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/leaves/${currentUser.employee_id}`,
      );

      const data = await res.json();

      console.log("LEAVES:", data);

      setLeaveRequests(
        data.map((r: any) => ({
          id: r.request_id,
          requester: currentUser.name,
          livestream: "All Streams",
          day:
            r.from === r.to
              ? new Date(r.from).toLocaleDateString()
              : `${new Date(r.from).toLocaleDateString()} - ${new Date(r.to).toLocaleDateString()}`,
          shift: "All",
          role: "Host", // can improve later
          leaveType: r.leave_type,
          reason: r.reason || "—", // optional (not returned yet)
          status: r.status,
          submittedAt: new Date().toISOString(),
        })),
      );
    } catch (err) {
      console.error("Failed to fetch leaves", err);
    }
  };

  const fetchAllLeaves = async () => {
    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/leaves",
      );

      const data = await res.json();

      console.log("ALL LEAVES:", data);

      setLeaveRequests(
        data.map((r: any) => ({
          id: r.request_id,
          requester:
            employeesMap[Number(r.employee_id)] || `Employee ${r.employee_id}`,
          livestream: "All Streams",
          day:
            r.from === r.to
              ? new Date(r.from).toLocaleDateString()
              : `${new Date(r.from).toLocaleDateString()} - ${new Date(r.to).toLocaleDateString()}`,
          shift: "All",
          role: "Host",
          leaveType: r.leave_type,
          reason: r.reason || "—",
          status: r.status,
          submittedAt: new Date().toISOString(),
        })),
      );
    } catch (err) {
      console.error("Failed to fetch all leaves", err);
    }
  };

  const fetchCoverRequests = async () => {
    try {
      const endpoint =
        role === "admin"
          ? `https://backend-production-6e75.up.railway.app/coverage-requests-admin?company_id=${currentUser.company_id}`
          : `https://backend-production-6e75.up.railway.app/coverage-requests/${currentUser.employee_id}`;

      const res = await fetch(endpoint);
      const data = await res.json();

      console.log("COVER REQUESTS:", data);

      setCoverRequests(
        data.map((r: any) => ({
          id: String(r.id),

          schedule_id: Number(r.schedule_id),

          requested_by: Number(r.requested_by),

          requester: r.requester,

          livestream: r.livestream,

          day: new Date(r.day).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          }),

          shift: r.shift,

          role: String(r.role || "").replace(/_/g, " "),

          reason: r.reason,

          status: r.status,

          request_type: r.request_type,

          is_targeted: r.is_targeted,

          submittedAt: new Date().toISOString(),
        })),
      );
    } catch (err) {
      console.error("Failed to load cover requests", err);
    }
  };

  const fetchCompanySettings = async () => {
  try {
    if (!currentUser.company_id) return;

    const res = await fetch(
      `https://backend-production-6e75.up.railway.app/settings?company_id=${currentUser.company_id}`,
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Failed to fetch company settings:", data);
      return;
    }

    setAbsenceReplacementMode(data.absence_replacement_mode || "Manual");
  } catch (err) {
    console.error("Failed to fetch company settings:", err);
  }
};

  const fetchShiftTemplates = async () => {
    try {
      if (!currentUser.company_id) return;

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/shift-templates?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      setShiftTemplates(data);
    } catch (err) {
      console.error("Failed to load shift templates", err);
    }
  };

  const fetchApplications = async () => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/shift-applications?company_id=${currentUser.company_id}`,
      );

      const data = await res.json();

      setApplications(
        data.map((a: any) => ({
          id: String(a.id),

          coverage_request_id: String(a.coverage_request_id),

          applicant: a.applicant,

          employee_id: a.employee_id,

          livestream: a.livestream,

          day: new Date(a.day).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          }),

          shift: a.shift,

          role: String(a.role || "").replace(/_/g, " "),

          reason: a.reason,

          status: a.status,

          appliedAt: new Date().toISOString(),
        })),
      );
    } catch (err) {
      console.error("Failed to fetch applications", err);
    }
  };

  const fetchEmployees = () => {
    if (!currentUser.company_id) {
      setEmployees([]);
      return;
    }

    fetch(
      `https://backend-production-6e75.up.railway.app/employees?company_id=${currentUser.company_id}`,
    )
      .then((res) => res.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => console.log("Failed to load employees"));
  };
  
  const processAutomaticCoverRequests = async () => {
    try {
      const res = await fetch(
         `https://backend-production-6e75.up.railway.app/coverage-requests/process-automatic?company_id=${currentUser.company_id}`,
        {
          method: "POST",
        },
      );

      const data = await res.json();

      console.log("AUTOMATIC COVER PROCESS:", data);
    } catch (err) {
      console.error("Failed to process automatic cover requests", err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await processAutomaticCoverRequests();

      fetchCompanySettings();
      fetchMyShifts();
      fetchEmployees();
      fetchApplications();
      fetchCoverRequests();
      fetchShiftTemplates();

      if (role !== "admin") {
        fetchMyLeaves();
      }
    };

    loadData();

    const interval = setInterval(() => {
      processAutomaticCoverRequests().then(() => {
        fetchCoverRequests();
        fetchApplications();
        fetchMyShifts();
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (role === "admin" && employees.length > 0) {
      fetchAllLeaves();
    }
  }, [employees]);

  // Available shifts
  const availableShifts = coverRequests.filter(
    (r) =>
      r.status === "pending" &&
      r.requester !== currentUser.name &&
      !applications.some(
        (a) =>
          a.applicant === currentUser.name &&
          a.coverage_request_id === r.id &&
          a.status === "pending",
      ),
  );

  const pendingCoverRequestScheduleIds = new Set(
    coverRequests
      .filter(
        (request) =>
          role !== "admin" &&
          request.status === "pending" &&
          Number(request.requested_by) === Number(currentUser.employee_id) &&
          request.schedule_id,
      )
      .map((request) => Number(request.schedule_id)),
  );

  const requestableMyShifts =
    role === "admin"
      ? myShifts
      : myShifts.filter(
          (shift) =>
            !pendingCoverRequestScheduleIds.has(Number(shift.schedule_id)),
        );

  const [isCoverDialogOpen, setIsCoverDialogOpen] = useState(false);

  const [selectedShift, setSelectedShift] = useState<{
    schedule_id: number;
    livestream: string;
    day: string;
    shift: string;
    role: string;
  } | null>(null);

  const [coverReason, setCoverReason] = useState("");

  // Standalone leave request states
  const [selectedLeaveDateRange, setSelectedLeaveDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [standaloneLeaveReason, setStandaloneLeaveReason] = useState("");

  const [standaloneLeaveType, setStandaloneLeaveType] = useState(
    LEAVE_TYPES[0],
  );

  const openCoverDialog = (shiftObj: {
    schedule_id: number;
    livestream: string;
    day: string;
    shift: string;
    role: string;
  }) => {
    if (!shiftObj.schedule_id) {
      toast.error("Invalid shift");
      return;
    }

    setSelectedShift(shiftObj);
    setCoverReason("");
    setIsCoverDialogOpen(true);
  };

  const submitCoverRequest = async () => {
    if (!selectedShift || !coverReason.trim()) {
      toast.error("Please provide a reason for your cover request");
      return;
    }

    if (!selectedShift?.schedule_id) {
      toast.error("Invalid shift");
      return;
    }

    try {
      const scheduleId = selectedShift.schedule_id;

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/request-cover/${scheduleId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: currentUser.employee_id,
            reason: coverReason,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to submit request");
      }

      if (data.message === "Already requested") {
        toast.info("You already requested cover for this shift.");
      } else {
        toast.success(data.message);
      }

      await fetchCoverRequests();
      await fetchMyShifts();

      setIsCoverDialogOpen(false);
      setCoverReason("");
      setSelectedShift(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit request");
    }
  };

  // const submitLeaveRequest = () => {
  //   if (!selectedShift || !leaveReason.trim()) {
  //     toast.error(
  //       "Please provide a reason for your leave request",
  //     );
  //     return;
  //   }

  const submitStandaloneLeaveRequest = async () => {
    if (!selectedLeaveDateRange.from) {
      toast.error("Please select a start date");
      return;
    }

    if (!standaloneLeaveReason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    try {
      const res = await fetch(
        "https://backend-production-6e75.up.railway.app/leaves",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employee_id: currentUser.employee_id,
            from: selectedLeaveDateRange.from.toISOString().split("T")[0],
            to: (selectedLeaveDateRange.to || selectedLeaveDateRange.from)
              .toISOString()
              .split("T")[0],
            leave_type: standaloneLeaveType,
            reason: standaloneLeaveReason,
          }),
        },
      );

      console.log("STATUS:", res.status);

      const raw = await res.text();
      console.log("RAW RESPONSE:", raw);

      if (!res.ok) {
        toast.error("Backend error: " + raw);
        return;
      }

      const data = JSON.parse(raw);

      if (data.error) {
        console.error("BACKEND ERROR:", data.error);
        toast.error(data.error);
        return;
      }

      toast.success("Leave request submitted!");

      // 🔥 refresh list
      fetchMyLeaves();

      // 🔥 reset UI
      setSelectedLeaveDateRange({ from: undefined, to: undefined });
      setStandaloneLeaveReason("");
      setStandaloneLeaveType(LEAVE_TYPES[0]);
    } catch (err) {
      console.error("FETCH FAILED:", err);
      toast.error("Network or parsing error");
    }
  };

  // Helper function to check if a date is disabled (less than 1 week from today)
  const isDateDisabled = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneWeekFromNow = new Date(today);
    oneWeekFromNow.setDate(today.getDate() + 7);

    return date < oneWeekFromNow;
  };

  const updateApplicationStatus = async (
    id: string,
    status: "approved" | "denied",
  ) => {
    try {
      const endpoint =
        status === "approved"
          ? `/shift-applications/${id}/approve`
          : `/shift-applications/${id}/deny`;

      await fetch(`https://backend-production-6e75.up.railway.app${endpoint}`, {
        method: "POST",
      });

      toast.success(`Application ${status}`);

      fetchApplications();

      fetchCoverRequests();

      fetchMyShifts();
    } catch (err) {
      console.error(err);

      toast.error("Failed to update application");
    }
  };

  const applyForCover = async (
    requestId: string,
    requestType: "normal" | "emergency",
  ) => {
    try {
      if (!requestId) {
        toast.error("Invalid cover request");
        return;
      }

      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/coverage-requests/${requestId}/apply`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employee_id: currentUser.employee_id,
            reason: "Can cover this shift",
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        let errorMessage = "You are not allowed to apply for this cover request.";

        if (typeof data.detail === "string") {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail) && data.detail.length > 0) {
          errorMessage = data.detail[0]?.msg || errorMessage;
        } else if (data.detail) {
          errorMessage = JSON.stringify(data.detail);
        }

        toast.error("Unable to apply for cover, maximum shifts reached", {
        });

        return;
      }

      if (data.message === "Shift automatically transferred") {
        toast.success("Emergency cover accepted, shift immediately accepted because this request needs urgent coverage.", {
        });
      } else if (requestType === "emergency") {
        toast.success("Emergency cover application submitted", {
        });
      } else if (absenceReplacementMode.toLowerCase() === "automatic") {
        toast.success("Cover application submitted, The system will automatically choose the best applicant when the request reaches the automatic processing window.", {
        });
      } else {
        toast.success("Cover application submitted, An admin must approve your application before the shift is transferred.", {
        });
      }

      fetchCoverRequests();
      fetchApplications();
      fetchMyShifts();
    } catch (err) {
      console.error(err);
      toast.error("Failed to apply");
    }
  };

  const updateLeaveStatus = async (
    requestId: string,
    status: "approved" | "rejected",
  ) => {
    try {
      const res = await fetch(
        `https://backend-production-6e75.up.railway.app/leaves/${requestId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        },
      );

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Leave request ${status}`);

      // 🔥 REFRESH FROM BACKEND (IMPORTANT)
      fetchAllLeaves();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update leave");
    }
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

  const getRoleBadgeColor = (role: string) => {
    return role === "Host"
      ? "bg-pink-100 text-pink-700"
      : "bg-purple-100 text-purple-700";
  };

  const getShiftInfo = (code: string) => {
    return shiftTemplates.find((s) => s.shift_name === code);
  };

  const fetchMyShifts = async () => {
  try {
    if (!currentUser.company_id) {
      console.error("Missing company_id in CoverApplication currentUser");
      setMyShifts([]);
      return;
    }

    const res = await fetch(
      `https://backend-production-6e75.up.railway.app/generated-schedule?company_id=${currentUser.company_id}`,
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.detail || "Failed to load my shifts");
    }

    console.log("SCHEDULE DATA:", data.assignments);

    setMyShifts(
      (data.assignments || [])
        .filter(
          (s: any) =>
            Number(s.employee_id) === Number(currentUser.employee_id),
        )
        .map((s: any) => ({
          schedule_id: s.schedule_id,
          livestream: s.account || s.livestream || s.account_name,
          day: new Date(s.shift_date).toLocaleDateString("en-US", {
            weekday: "long",
          }),
          shift: s.shift_type || s.shift || s.shift_name,
          role: String(s.role || s.role_key || "").replace(/_/g, " "),
        })),
    );
  } catch (err) {
    console.error("Failed to load my shifts", err);
    setMyShifts([]);
  }
};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl">Shift Applications & Requests</h2>
          <p className="text-gray-600">
            Apply for shifts, request coverage, or submit leave
          </p>
        </div>
        <Badge variant="secondary">{role}</Badge>
      </div>

      <Tabs
        defaultValue={role === "admin" ? "requests" : "available"}
        className="space-y-6"
      >
        <TabsList
          className={
            role === "admin"
              ? "grid w-full max-w-xs grid-cols-1"
              : "grid w-full max-w-2xl grid-cols-3"
          }
        >
          {role !== "admin" && (
            <>
              <TabsTrigger value="available" className="gap-2">
                <CalendarIcon className="size-4" />
                Available Shifts
              </TabsTrigger>
              <TabsTrigger value="myshifts" className="gap-2">
                <UserX className="size-4" />
                My Shifts
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="requests" className="gap-2">
            <ClipboardList className="size-4" />
            All Requests
          </TabsTrigger>
        </TabsList>

        {/* Available Shifts Tab - Only visible for non-admin users */}
        {role !== "admin" && (
          <TabsContent value="available" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="size-5" />
                  Available Shifts to Apply
                </CardTitle>
                <CardDescription>
                  Apply for open shifts that need coverage
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {availableShifts.map((slot, index) => {
                    const shiftInfo = getShiftInfo(slot.shift);
                    return (
                      <Card
                        key={index}
                        className={`border-2 ${getShiftColor(slot.shift)}`}
                      >
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge
                                className={`text-base px-3 py-1 border ${getShiftColor(
                                  slot.shift,
                                )} ${getShiftTextColor(slot.shift)}`}
                              >
                                {slot.shift}
                              </Badge>
                              <Badge className={getRoleBadgeColor(slot.role)}>
                                {slot.role}
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <div className="font-bold text-blue-700">
                                {slot.livestream}
                              </div>
                              <div className="font-medium">{slot.day}</div>
                              <div className="text-gray-600">
                                {shiftInfo?.name}
                              </div>
                              <div className="text-gray-600">
                                {shiftInfo?.time}
                              </div>
                            </div>
                            <Button
                              onClick={() => applyForCover(slot.id)}
                              className="w-full"
                              size="sm"
                            >
                              applying to cover
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* My Shifts Tab - Only visible for non-admin users */}
        {role !== "admin" && (
          <TabsContent value="myshifts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="size-5" />
                  My Assigned Shifts
                </CardTitle>
                <CardDescription>
                  View your scheduled shifts and request coverage if needed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {requestableMyShifts.length === 0 && (
                    <p className="text-sm text-gray-500">
                      No shifts available for cover request. Shifts with pending
                      cover requests are hidden.
                    </p>
                  )}
                  {requestableMyShifts.map((slot, index) => {
                    const shiftInfo = getShiftInfo(slot.shift);
                    return (
                      <Card
                        key={index}
                        className={`border-2 ${getShiftColor(slot.shift)}`}
                      >
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge
                                className={`text-base px-3 py-1 border ${getShiftColor(
                                  slot.shift,
                                )} ${getShiftTextColor(slot.shift)}`}
                              >
                                {slot.shift}
                              </Badge>
                              <Badge className={getRoleBadgeColor(slot.role)}>
                                {slot.role}
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <div className="font-bold text-blue-700">
                                {slot.livestream}
                              </div>
                              <div className="font-medium">{slot.day}</div>
                              <div className="text-gray-600">
                                {shiftInfo?.name}
                              </div>
                              <div className="text-gray-600">
                                {shiftInfo?.time}
                              </div>
                            </div>
                            <Button
                              onClick={() => openCoverDialog(slot)}
                              variant="outline"
                              className="w-full"
                              size="sm"
                            >
                              Request Cover
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Standalone Leave Request Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plane className="size-5" />
                  Request Leave
                </CardTitle>
                <CardDescription>
                  Select start and end dates for your leave request (must be at
                  least 1 week in advance)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Leave Period</Label>
                  <div className="border rounded-md p-3">
                    <Calendar
                      mode="range"
                      selected={selectedLeaveDateRange}
                      onSelect={(range) =>
                        setSelectedLeaveDateRange(
                          range || { from: undefined, to: undefined },
                        )
                      }
                      disabled={isDateDisabled}
                      numberOfMonths={2}
                      className="mx-auto"
                    />
                  </div>
                  {selectedLeaveDateRange.from && (
                    <div className="text-sm p-3 bg-blue-50 text-blue-700 rounded-md">
                      {selectedLeaveDateRange.to ? (
                        selectedLeaveDateRange.from.getTime() ===
                        selectedLeaveDateRange.to.getTime() ? (
                          <p>
                            <strong>Selected Date:</strong>{" "}
                            {selectedLeaveDateRange.from.toLocaleDateString(
                              "en-US",
                              {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              },
                            )}
                          </p>
                        ) : (
                          <p>
                            <strong>Leave Period:</strong>{" "}
                            {selectedLeaveDateRange.from.toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}{" "}
                            -{" "}
                            {selectedLeaveDateRange.to.toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </p>
                        )
                      ) : (
                        <p>
                          <strong>Start Date:</strong>{" "}
                          {selectedLeaveDateRange.from.toLocaleDateString(
                            "en-US",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                          <br />
                          <span className="text-xs">
                            Click another date to select end date
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                  <p className="text-sm text-gray-500">
                    Dates within the next 7 days are unavailable
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="standalone-leave-type">Leave Type</Label>
                  <Select
                    value={standaloneLeaveType}
                    onValueChange={setStandaloneLeaveType}
                  >
                    <SelectTrigger id="standalone-leave-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAVE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="standalone-leave-reason">Reason</Label>
                  <Textarea
                    id="standalone-leave-reason"
                    placeholder="Provide a reason for your leave request..."
                    value={standaloneLeaveReason}
                    onChange={(e) => setStandaloneLeaveReason(e.target.value)}
                    rows={4}
                  />
                </div>

                <Button
                  onClick={submitStandaloneLeaveRequest}
                  className="w-full gap-2"
                >
                  <Plane className="size-4" />
                  Submit Leave Request
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* All Requests Tab */}
        <TabsContent value="requests" className="space-y-6">
          {/* Shift Applications Table */}
          <Card>
            <CardHeader>
              <CardTitle>Shift Applications</CardTitle>
              <CardDescription>
                {role === "admin"
                  ? "Review and manage shift applications"
                  : "Track your shift application status"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {applications.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Applicant</TableHead>
                        <TableHead>Livestream</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        {role === "admin" && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications
                        .filter(
                          (app) =>
                            role === "admin" ||
                            app.employee_id === currentUser.employee_id,
                        )
                        .map((application) => {
                          const shiftInfo = getShiftInfo(application.shift);
                          return (
                            <TableRow key={application.id}>
                              <TableCell>{application.applicant}</TableCell>
                              <TableCell>
                                <span className="font-semibold text-blue-700">
                                  {application.livestream}
                                </span>
                              </TableCell>
                              <TableCell>{application.day}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {application.shift} - {shiftInfo?.name}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {shiftInfo?.time}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={getRoleBadgeColor(
                                    application.role,
                                  )}
                                >
                                  {application.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {application.reason}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(application.status)}
                                  {getStatusBadge(application.status)}
                                </div>
                              </TableCell>
                              {role === "admin" && (
                                <TableCell>
                                  {application.status === "pending" && (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          updateApplicationStatus(
                                            application.id,
                                            "approved",
                                          )
                                        }
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          updateApplicationStatus(
                                            application.id,
                                            "denied",
                                          )
                                        }
                                      >
                                        Deny
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4">
                  No shift applications found
                </p>
              )}
            </CardContent>
          </Card>

          {/* Cover Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="size-5" />
                Cover Requests
              </CardTitle>
              <CardDescription>
                {role === "admin"
                  ? "View employee coverage requests"
                  : "Track your coverage request status"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {coverRequests.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requester</TableHead>
                        <TableHead>Livestream</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverRequests
                        .filter(
                          (request) =>
                            role === "admin" ||
                            request.requester === currentUser.name,
                        )
                        .map((request) => {
                          const shiftInfo = getShiftInfo(request.shift);
                          return (
                            <TableRow key={request.id}>
                              <TableCell>{request.requester}</TableCell>
                              <TableCell>
                                <span className="font-semibold text-blue-700">
                                  {request.livestream}
                                </span>
                              </TableCell>
                              <TableCell>{request.day}</TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {request.shift} - {shiftInfo?.name}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {shiftInfo?.time}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={getRoleBadgeColor(request.role)}
                                >
                                  {request.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {request.reason}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    request.request_type === "emergency"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {request.request_type}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(request.status)}
                                  {getStatusBadge(request.status)}
                                </div>
                              </TableCell>
                              <TableCell>
                                {role !== "admin" &&
                                  request.status === "pending" &&
                                  request.requester !== currentUser.name && (
                                    <Button
                                      size="sm"
                                      onClick={() => applyForCover(request.id)}
                                    >
                                      Accept Cover
                                    </Button>
                                  )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4">
                  No cover requests found
                </p>
              )}
            </CardContent>
          </Card>

          {/* Leave Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plane className="size-5" />
                Leave Requests
              </CardTitle>
              <CardDescription>
                {role === "admin"
                  ? "Review and approve leave requests"
                  : "Track your leave request status"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {leaveRequests.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Requester</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        {role === "admin" && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests
                        .filter(
                          (req) =>
                            role === "admin" ||
                            req.requester === currentUser.name,
                        )
                        .map((request) => {
                          return (
                            <TableRow key={request.id}>
                              <TableCell>{request.requester}</TableCell>
                              <TableCell>{request.day}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {request.leaveType}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {request.reason}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(request.status)}
                                  {getStatusBadge(request.status)}
                                </div>
                              </TableCell>
                              {role === "admin" && (
                                <TableCell>
                                  {request.status === "pending" && (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          updateLeaveStatus(
                                            request.id,
                                            "approved",
                                          )
                                        }
                                      >
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() =>
                                          updateLeaveStatus(
                                            request.id,
                                            "rejected",
                                          )
                                        }
                                      >
                                        Deny
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 py-4">
                  No leave requests found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shift Application Dialog */}

      {/* Cover Request Dialog */}
      <Dialog open={isCoverDialogOpen} onOpenChange={setIsCoverDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Shift Coverage</DialogTitle>
            <DialogDescription>
              {selectedShift && (
                <div className="space-y-1 mt-2">
                  <div>
                    <strong>Livestream:</strong> {selectedShift.livestream}
                  </div>
                  <div>
                    <strong>Day:</strong> {selectedShift.day}
                  </div>
                  <div>
                    <strong>Shift:</strong>{" "}
                    {getShiftInfo(selectedShift.shift)?.name} (
                    {getShiftInfo(selectedShift.shift)?.time})
                  </div>
                  <div>
                    <strong>Role:</strong> {selectedShift.role}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="coverReason">Reason for Coverage Request</Label>
              <Textarea
                id="coverReason"
                placeholder="Please explain why you need coverage for this shift..."
                value={coverReason}
                onChange={(e) => setCoverReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCoverDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={submitCoverRequest}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
