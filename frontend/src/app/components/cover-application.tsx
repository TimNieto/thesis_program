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
  applicant: string;
  livestream: string;
  day: string;
  shift: string;
  role: "Host" | "Operator";
  reason: string;
  status: "pending" | "approved" | "denied";
  appliedAt: string;
}

interface CoverRequest {
  id: string;
  requester: string;
  livestream: string;
  day: string;
  shift: string;
  role: "Host" | "Operator";
  reason: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
}

interface LeaveRequest {
  id: string;
  requester: string;
  livestream: string;
  day: string;
  shift: string;
  role: "Host" | "Operator";
  leaveType: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  submittedAt: string;
}

interface CoverApplicationProps {
  currentUser: {
    employee_id: number;
    name: string;
  };
  role: string;
}

const SHIFTS = [
  { code: "GY", name: "Graveyard", time: "01:00 - 07:00" },
  { code: "AM", name: "Morning", time: "07:00 - 13:00" },
  { code: "NN", name: "Noon", time: "13:00 - 19:00" },
  { code: "PM", name: "Evening", time: "19:00 - 01:00" },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const LIVESTREAMS = ["Mommypoko", "Sofy"];
const ROLES = ["Host", "Operator"] as const;
const LEAVE_TYPES = [
  "Sick Leave",
  "Vacation",
  "Personal",
  "Emergency",
  "Other",
];

export function CoverApplication({
  currentUser,
  role,
}: CoverApplicationProps) {
  const [applications, setApplications] = useState<
    ShiftApplication[]
  >([
    {
      id: "1",
      applicant: "Mike Davis",
      livestream: "Mommypoko",
      day: "Thursday",
      shift: "GY",
      role: "Host",
      reason: "Looking for extra hours",
      status: "pending",
      appliedAt: "2026-01-25T10:30:00",
    },
    {
      id: "2",
      applicant: "Emma Wilson",
      livestream: "Sofy",
      day: "Friday",
      shift: "NN",
      role: "Operator",
      reason: "Can cover this shift",
      status: "approved",
      appliedAt: "2026-01-24T14:20:00",
    },
  ]);

  const [coverRequests, setCoverRequests] = useState<CoverRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);

  const [myShifts, setMyShifts] = useState<any[]>([]);

  const fetchMyLeaves = async () => {
  try {
    const res = await fetch(
      `https://thesisprogram-production.up.railway.app/leaves/${currentUser.employee_id}`
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
        reason: "", // optional (not returned yet)
        status: r.status,
        submittedAt: new Date().toISOString()
      }))
    );

  } catch (err) {
    console.error("Failed to fetch leaves", err);
  }
};

  const fetchCoverRequests = async () => {
    try {
      const res = await fetch("https://thesisprogram-production.up.railway.app/coverage-requests");
      const data = await res.json();

      console.log("COVER REQUESTS:", data);

      setCoverRequests(
        data.map((r: any) => ({
          id: String(r.id),
          requester: r.requester,
          livestream: "N/A", // temporary (we improve later)
          day: "N/A",
          shift: r.shift,
          role: r.role === "host" ? "Host" : "Operator",
          reason: r.reason,
          status: r.status,
          submittedAt: new Date().toISOString()
        }))
      );

    } catch (err) {
      console.error("Failed to load cover requests", err);
    }
  };

  useEffect(() => {
    fetchMyShifts();
    fetchMyLeaves();
  }, []);

  useEffect(() => {
    fetchCoverRequests();
  }, []);

  // Available shifts (mock data)
  const [availableShifts] = useState([
    {
      livestream: "Mommypoko",
      day: "Thursday",
      shift: "PM",
      role: "Host" as const,
    },
    {
      livestream: "Mommypoko",
      day: "Friday",
      shift: "GY",
      role: "Operator" as const,
    },
    {
      livestream: "Sofy",
      day: "Wednesday",
      shift: "AM",
      role: "Host" as const,
    },
    {
      livestream: "Sofy",
      day: "Thursday",
      shift: "PM",
      role: "Operator" as const,
    },
    {
      livestream: "Mommypoko",
      day: "Saturday",
      shift: "GY",
      role: "Host" as const,
    },
    {
      livestream: "Sofy",
      day: "Sunday",
      shift: "AM",
      role: "Operator" as const,
    },
  ]);


  const [isApplicationDialogOpen, setIsApplicationDialogOpen] =
    useState(false);

  const [isCoverDialogOpen, setIsCoverDialogOpen] =
    useState(false);


  const [selectedShift, setSelectedShift] = useState<{
  schedule_id: number;
  livestream: string;
  day: string;
  shift: string;
  role: "Host" | "Operator";
} | null>(null);

  const [applicationReason, setApplicationReason] =
    useState("");

  const [coverReason, setCoverReason] = useState("");


  // Standalone leave request states
  const [selectedLeaveDateRange, setSelectedLeaveDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });
  const [standaloneLeaveReason, setStandaloneLeaveReason] = useState("");

  const [standaloneLeaveType, setStandaloneLeaveType] = useState(LEAVE_TYPES[0]);

  const openApplicationDialog = (slot: any) => {
    setSelectedShift({
      schedule_id: slot.schedule_id, // ⚠️ may be undefined for now (OK)
      livestream: slot.livestream,
      day: slot.day,
      shift: slot.shift,
      role: slot.role,
    });

    setApplicationReason("");
    setIsApplicationDialogOpen(true);
  };

  const openCoverDialog = (shiftObj: {
    schedule_id: number;
    livestream: string;
    day: string;
    shift: string;
    role: "Host" | "Operator";
  }) => {
    if (!shiftObj.schedule_id) {
      toast.error("Invalid shift");
      return;
    }

    setSelectedShift(shiftObj);
    setCoverReason("");
    setIsCoverDialogOpen(true);
  };


  const submitApplication = () => {
    if (!selectedShift || !applicationReason.trim()) {
      toast.error(
        "Please provide a reason for your application",
      );
      return;
    }

    const application: ShiftApplication = {
      id: Date.now().toString(),
      applicant: currentUser.name,
      livestream: selectedShift.livestream,
      day: selectedShift.day,
      shift: selectedShift.shift,
      role: selectedShift.role,
      reason: applicationReason,
      status: "pending",
      appliedAt: new Date().toISOString(),
    };

    setApplications([application, ...applications]);
    setIsApplicationDialogOpen(false);
    setApplicationReason("");
    setSelectedShift(null);
    toast.success("Shift application submitted successfully");
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

      const res = await fetch(`https://thesisprogram-production.up.railway.app/request-cover/${scheduleId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: currentUser.employee_id,
          reason: coverReason,
        }),
      });

      const data = await res.json();

      toast.success(data.message);

      fetchCoverRequests();

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
        const res = await fetch("https://thesisprogram-production.up.railway.app/leaves", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            employee_id: currentUser.employee_id,
            from: selectedLeaveDateRange.from.toISOString().split("T")[0],
            to: (selectedLeaveDateRange.to || selectedLeaveDateRange.from)
                  .toISOString().split("T")[0],
            leave_type: standaloneLeaveType,
            reason: standaloneLeaveReason
          })
        });

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

  const updateApplicationStatus = (
    id: string,
    status: "approved" | "denied",
  ) => {
    setApplications(
      applications.map((app) =>
        app.id === id ? { ...app, status } : app,
      ),
    );
    toast.success(`Application ${status}`);
  };

  const updateCoverStatus = async (id: string, status: "approved" | "denied") => {
    try {
      const endpoint =
        status === "approved"
          ? `/coverage-requests/${id}/approve`
          : `/coverage-requests/${id}/deny`;

      await fetch(`https://thesisprogram-production.up.railway.app${endpoint}`, {
        method: "POST",
      });

      // refresh data after update
      fetchCoverRequests();

      toast.success(`Cover request ${status}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update request");
    }
  };

  const updateLeaveStatus = (
    id: string,
    status: "approved" | "denied",
  ) => {
    setLeaveRequests(
      leaveRequests.map((req) =>
        req.id === id ? { ...req, status } : req,
      ),
    );
    toast.success(`Leave request ${status}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <CheckCircle className="size-4 text-green-600" />
        );
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
      <Badge
        variant={
          variants[status as keyof typeof variants] as any
        }
      >
        {status}
      </Badge>
    );
  };

  const getShiftColor = (shift: string) => {
    const colors = {
      GY: "bg-indigo-50 text-indigo-700 border-indigo-200",
      AM: "bg-yellow-50 text-yellow-700 border-yellow-200",
      NN: "bg-orange-50 text-orange-700 border-orange-200",
      PM: "bg-blue-50 text-blue-700 border-blue-200",
    };
    return colors[shift as keyof typeof colors] || "bg-gray-50";
  };

  const getRoleBadgeColor = (role: "Host" | "Operator") => {
    return role === "Host"
      ? "bg-pink-100 text-pink-700"
      : "bg-purple-100 text-purple-700";
  };

  const getShiftInfo = (code: string) => {
    return SHIFTS.find((s) => s.code === code);
  };

  const fetchMyShifts = async () => {
    try {
      const res = await fetch("https://thesisprogram-production.up.railway.app/generated-schedule")
      const data = await res.json();

      console.log("SCHEDULE DATA:", data.assignments);

      setMyShifts(
        (data.assignments || [])
          .filter((s: any) => s.employee_id === currentUser.employee_id)
          .map((s: any) => ({
            schedule_id: s.schedule_id,  // 🔥 THIS FIXES EVERYTHING
            livestream: s.account,
            day: new Date(s.shift_date).toLocaleDateString("en-US", { weekday: "long" }),
            shift: s.shift_type,
            role: s.role === "host" ? "Host" : "Operator"
          }))
      );

    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl">
            Shift Applications & Requests
          </h2>
          <p className="text-gray-600">
            Apply for shifts, request coverage, or submit leave
          </p>
        </div>
        <Badge variant="secondary">{role}</Badge>
      </div>

      <Tabs defaultValue={role === "admin" ? "requests" : "available"} className="space-y-6">
        <TabsList className={role === "admin" ? "grid w-full max-w-xs grid-cols-1" : "grid w-full max-w-2xl grid-cols-3"}>
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
                              <Badge className="text-base px-3 py-1">
                                {slot.shift}
                              </Badge>
                              <Badge
                                className={getRoleBadgeColor(
                                  slot.role,
                                )}
                              >
                                {slot.role}
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <div className="font-bold text-blue-700">
                                {slot.livestream}
                              </div>
                              <div className="font-medium">
                                {slot.day}
                              </div>
                              <div className="text-gray-600">
                                {shiftInfo?.name}
                              </div>
                              <div className="text-gray-600">
                                {shiftInfo?.time}
                              </div>
                            </div>
                            <Button
                              onClick={() => openApplicationDialog(slot)}
                              className="w-full"
                              size="sm"
                            >
                              Apply for Shift
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
                  {myShifts.map((slot, index) => {
                    const shiftInfo = getShiftInfo(slot.shift);
                    return (
                      <Card
                        key={index}
                        className={`border-2 ${getShiftColor(slot.shift)}`}
                      >
                        <CardContent className="pt-6">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Badge className="text-base px-3 py-1">
                                {slot.shift}
                              </Badge>
                              <Badge
                                className={getRoleBadgeColor(
                                  slot.role,
                                )}
                              >
                                {slot.role}
                              </Badge>
                            </div>
                            <div className="text-sm">
                              <div className="font-bold text-blue-700">
                                {slot.livestream}
                              </div>
                              <div className="font-medium">
                                {slot.day}
                              </div>
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
                  Select start and end dates for your leave request (must be at least 1 week in advance)
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
                          range || { from: undefined, to: undefined }
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
                        selectedLeaveDateRange.from.getTime() === selectedLeaveDateRange.to.getTime() ? (
                          <p>
                            <strong>Selected Date:</strong>{" "}
                            {selectedLeaveDateRange.from.toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        ) : (
                          <p>
                            <strong>Leave Period:</strong>{" "}
                            {selectedLeaveDateRange.from.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}{" "}
                            -{" "}
                            {selectedLeaveDateRange.to.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        )
                      ) : (
                        <p>
                          <strong>Start Date:</strong>{" "}
                          {selectedLeaveDateRange.from.toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                          <br />
                          <span className="text-xs">Click another date to select end date</span>
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
                    onChange={(e) =>
                      setStandaloneLeaveReason(e.target.value)
                    }
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
                        {role === "admin" && (
                          <TableHead>Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications
                        .filter(
                          (app) =>
                            role === "admin" ||
                            app.applicant === currentUser.name
                        )
                        .map((application) => {
                          const shiftInfo = getShiftInfo(
                            application.shift,
                          );
                          return (
                            <TableRow key={application.id}>
                              <TableCell>
                                {application.applicant}
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold text-blue-700">
                                  {application.livestream}
                                </span>
                              </TableCell>
                              <TableCell>
                                {application.day}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {application.shift} -{" "}
                                    {shiftInfo?.name}
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
                                  {getStatusIcon(
                                    application.status,
                                  )}
                                  {getStatusBadge(
                                    application.status,
                                  )}
                                </div>
                              </TableCell>
                              {role === "admin" && (
                                <TableCell>
                                  {application.status ===
                                    "pending" && (
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
                  ? "Review and approve coverage requests"
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
                        <TableHead>Status</TableHead>
                        {role === "admin" && (
                          <TableHead>Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverRequests
                        .filter(
                          (req) =>
                            role === "admin" ||
                            req.requester === currentUser.name
                        )
                        .map((request) => {
                          const shiftInfo = getShiftInfo(
                            request.shift,
                          );
                          return (
                            <TableRow key={request.id}>
                              <TableCell>
                                {request.requester}
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold text-blue-700">
                                  {request.livestream}
                                </span>
                              </TableCell>
                              <TableCell>
                                {request.day}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {request.shift} -{" "}
                                    {shiftInfo?.name}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {shiftInfo?.time}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={getRoleBadgeColor(
                                    request.role,
                                  )}
                                >
                                  {request.role}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {request.reason}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(
                                    request.status,
                                  )}
                                  {getStatusBadge(
                                    request.status,
                                  )}
                                </div>
                              </TableCell>
                              {role === "admin" && (
                                <TableCell>
                                  {request.status ===
                                    "pending" && (
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        onClick={() =>
                                          updateCoverStatus(
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
                                          updateCoverStatus(
                                            request.id,
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
                        <TableHead>Livestream</TableHead>
                        <TableHead>Day</TableHead>
                        <TableHead>Shift</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Status</TableHead>
                        {role === "admin" && (
                          <TableHead>Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests
                        .filter(
                          (req) =>
                            role === "admin" ||
                            req.requester === currentUser.name
                        )
                        .map((request) => {
                          const shiftInfo = getShiftInfo(
                            request.shift,
                          );
                          return (
                            <TableRow key={request.id}>
                              <TableCell>
                                {request.requester}
                              </TableCell>
                              <TableCell>
                                <span className="font-semibold text-blue-700">
                                  {request.livestream}
                                </span>
                              </TableCell>
                              <TableCell>
                                {request.day}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {request.shift} -{" "}
                                    {shiftInfo?.name}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {shiftInfo?.time}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={getRoleBadgeColor(
                                    request.role,
                                  )}
                                >
                                  {request.role}
                                </Badge>
                              </TableCell>
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
                                  {getStatusIcon(
                                    request.status,
                                  )}
                                  {getStatusBadge(
                                    request.status,
                                  )}
                                </div>
                              </TableCell>
                              {role === "admin" && (
                                <TableCell>
                                  {request.status ===
                                    "pending" && (
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
                  No leave requests found
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shift Application Dialog */}
      <Dialog
        open={isApplicationDialogOpen}
        onOpenChange={setIsApplicationDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Shift</DialogTitle>
            <DialogDescription>
              {selectedShift && (
                <div className="space-y-1 mt-2">
                  <div>
                    <strong>Livestream:</strong>{" "}
                    {selectedShift.livestream}
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
              <Label htmlFor="applicationReason">
                Reason for Application
              </Label>
              <Textarea
                id="applicationReason"
                placeholder="Please explain why you'd like this shift..."
                value={applicationReason}
                onChange={(e) =>
                  setApplicationReason(e.target.value)
                }
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsApplicationDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={submitApplication}>
              Submit Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cover Request Dialog */}
      <Dialog
        open={isCoverDialogOpen}
        onOpenChange={setIsCoverDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Shift Coverage</DialogTitle>
            <DialogDescription>
              {selectedShift && (
                <div className="space-y-1 mt-2">
                  <div>
                    <strong>Livestream:</strong>{" "}
                    {selectedShift.livestream}
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
              <Label htmlFor="coverReason">
                Reason for Coverage Request
              </Label>
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
            <Button onClick={submitCoverRequest}>
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}