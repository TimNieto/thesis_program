// ---------------------------------------------------
// src/app/components/data-report.tsx

import { useEffect, useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/table";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Clock,
  Activity
} from "lucide-react";
import { toast } from "sonner";

interface DataReportProps {
  currentUser: {
    id: number;
    name: string;
    email: string;
    role: string;
    displayRole: string;
    company_id: number | null;
    company_name: string | null;
  };
}

interface GeneralData {
  period: string;
  start: string;
  end: string;
  isUtilizationApproximate: boolean;

  totalShifts: number;
  filledShifts: number;
  vacantShifts: number;

  totalAbsences: number;

  totalLeaveRequests: number;
  approvedLeaveRequests: number;
  pendingLeaveRequests: number;

  totalCoverageRequests: number;
  approvedCoverageRequests: number;
  pendingCoverageRequests: number;
  deniedCoverageRequests: number;

  totalCoverApplications: number;
  approvedCoverApplications: number;
}

interface EmployeeData {
  id: string;
  employee_id: number;
  name: string;

  totalShifts: number;
  maxWorkload: number;
  assignedWorkload: number;
  utilization: number;
  isUtilizationApproximate: boolean;

  coverageRequests: number;
  approvedCoverageRequests: number;
  pendingCoverageRequests: number;
  deniedCoverageRequests: number;

  coverApplications: number;
  approvedCoverApplications: number;
  pendingCoverApplications: number;
  deniedCoverApplications: number;

  absences: number;
  leaves: number;
}

export function DataReport({ currentUser }: DataReportProps) {
  const [timePeriod, setTimePeriod] = useState("this-month");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

const [generalData, setGeneralData] = useState<GeneralData>({
  period: "this-month",
  start: "",
  end: "",
  isUtilizationApproximate: true,

  totalShifts: 0,
  filledShifts: 0,
  vacantShifts: 0,

  totalAbsences: 0,

  totalLeaveRequests: 0,
  approvedLeaveRequests: 0,
  pendingLeaveRequests: 0,

  totalCoverageRequests: 0,
  approvedCoverageRequests: 0,
  pendingCoverageRequests: 0,
  deniedCoverageRequests: 0,

  totalCoverApplications: 0,
  approvedCoverApplications: 0,
});

const [employeeData, setEmployeeData] = useState<EmployeeData[]>([]);
const [loading, setLoading] = useState(false);

  const getTimePeriodLabel = () => {
    switch (timePeriod) {
      case "this-week":
        return "This Week";
      case "this-month":
        return "This Month";
      case "last-month":
        return "Last Month";
      case "last-3-months":
        return "Last 3 Months";
      case "this-year":
        return "This Year";
      default:
        return "This Month";
    }
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return "text-green-600";
    if (utilization >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getUtilizationBadge = (utilization: number) => {
    if (utilization >= 90) return "default";
    if (utilization >= 70) return "secondary";
    return "destructive";
  };


  const fetchReports = async () => {
    try {
      if (!currentUser.company_id) {
        toast.error("No company selected");
        return;
      }

      setLoading(true);

      const [generalRes, employeeRes] = await Promise.all([
        fetch(
          `https://backend-production-6e75.up.railway.app/reports/general?company_id=${currentUser.company_id}&period=${timePeriod}`,
        ),
        fetch(
          `https://backend-production-6e75.up.railway.app/reports/employees?company_id=${currentUser.company_id}&period=${timePeriod}`,
        ),
      ]);

      const generalJson = await generalRes.json();
      const employeeJson = await employeeRes.json();

      if (!generalRes.ok) {
        throw new Error(generalJson.detail || "Failed to load general report");
      }

      if (!employeeRes.ok) {
        throw new Error(employeeJson.detail || "Failed to load employee report");
      }

      setGeneralData(generalJson);

      setEmployeeData(
        (employeeJson.employees || []).map((employee: any) => ({
          ...employee,
          id: String(employee.employee_id),
        })),
      );
    } catch (err: any) {
      console.error("Failed to load reports:", err);
      toast.error(err.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [timePeriod, currentUser.company_id]);

  const exportReport = () => {
    const rows = [
      [
        "Employee",
        "Assigned Shifts",
        "Max Workload",
        "Utilization",
        "Cover Requests",
        "Cover Applications",
        "Absences",
        "Leaves",
      ],
      ...filteredEmployeeData.map((emp) => [
        emp.name,
        emp.totalShifts,
        emp.maxWorkload,
        `${emp.utilization.toFixed(1)}%`,
        emp.coverageRequests,
        emp.coverApplications,
        emp.absences,
        emp.leaves,
      ]),
    ];

    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `visioncore-report-${timePeriod}.csv`;
    link.click();

    URL.revokeObjectURL(url);

    toast.success("Report exported successfully");
  };

  const filteredEmployeeData = selectedEmployee === "all"
    ? employeeData
    : employeeData.filter((emp) => emp.id === selectedEmployee);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl">Data Report</h2>
          <p className="text-gray-600">View detailed reports and analytics</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label>Time Period:</Label>
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this-week">This Week</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
                <SelectItem value="this-year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportReport} variant="outline" className="gap-2">
            <BarChart3 className="size-4" />
            Export Report
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-500">Loading report data...</p>
      )}

      {/* Main Content Tabs */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full max-w-2xl grid-cols-2">
          <TabsTrigger value="general" className="gap-2">
            <TrendingUp className="size-4" />
            General Overview
          </TabsTrigger>
          <TabsTrigger value="employee" className="gap-2">
            <Users className="size-4" />
            Employee Overview
          </TabsTrigger>
        </TabsList>

        {/* General Overview Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>General Overview - {getTimePeriodLabel()}</CardTitle>
              <CardDescription>Summary of absences, coverage requests, and shifts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Absences</p>
                        <p className="text-3xl font-bold">{generalData.totalAbsences}</p>
                      </div>
                      <Calendar className="size-8 text-red-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Coverage Requests</p>
                        <p className="text-3xl font-bold">{generalData.totalCoverageRequests}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {generalData.approvedCoverageRequests} approved, {generalData.pendingCoverageRequests} pending
                        </p>
                      </div>
                      <Clock className="size-8 text-orange-600" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">Total Shifts</p>
                        <p className="text-3xl font-bold">{generalData.totalShifts}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {generalData.filledShifts} filled, {generalData.vacantShifts} vacant
                        </p>
                      </div>
                      <Activity className="size-8 text-blue-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Shift Coverage Rate</p>
                        <p className="text-sm text-gray-600">Percentage of filled shifts</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">
                          {generalData.totalShifts > 0
                            ? ((generalData.filledShifts / generalData.totalShifts) * 100).toFixed(1)
                            : "0.0"}%
                        </p>
                        <p className="text-xs text-gray-500">{generalData.filledShifts} / {generalData.totalShifts}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Coverage Request Approval Rate</p>
                        <p className="text-sm text-gray-600">Percentage of approved requests</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">
                          {generalData.totalCoverageRequests > 0
                            ? ((generalData.approvedCoverageRequests / generalData.totalCoverageRequests) * 100).toFixed(1)
                            : "0.0"}%
                        </p>
                        <p className="text-xs text-gray-500">{generalData.approvedCoverageRequests} / {generalData.totalCoverageRequests}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">Average Absences per Employee</p>
                        <p className="text-sm text-gray-600">Based on active employees</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-orange-600">
                          {employeeData.length > 0
                            ? (generalData.totalAbsences / employeeData.length).toFixed(1)
                            : "0.0"}
                        </p>
                        <p className="text-xs text-gray-500">{generalData.totalAbsences} total absences</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Employee Overview Tab */}
        <TabsContent value="employee" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Employee Overview - {getTimePeriodLabel()}</CardTitle>

                  {generalData.isUtilizationApproximate && (
                    <p className="text-xs text-orange-600 mt-1">
                      Utilization is approximate because this report uses the current weekly workload setting for the whole selected period.
                    </p>
                  )}

                  <CardDescription>Individual employee performance and workload data</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Filter Employee:</Label>
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employeeData.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Total Shifts</TableHead>
                      <TableHead>Cover Requests</TableHead>
                      <TableHead>Cover Applications</TableHead>
                      <TableHead>Absences</TableHead>
                      <TableHead>Leaves</TableHead>
                      <TableHead>Workload</TableHead>
                      <TableHead>Utilization</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployeeData.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell className="font-medium">{employee.name}</TableCell>
                        <TableCell>{employee.totalShifts}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={employee.coverageRequests > 2 ? "destructive" : "secondary"}>
                              {employee.coverageRequests}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {employee.approvedCoverageRequests} approved
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={employee.coverApplications > 2 ? "destructive" : "secondary"}>
                              {employee.coverApplications}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {employee.approvedCoverApplications} approved
                            </span>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant={employee.absences > 2 ? "destructive" : "secondary"}>
                            {employee.absences}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <Badge variant={employee.leaves > 2 ? "destructive" : "secondary"}>
                            {employee.leaves}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{employee.assignedWorkload} / {employee.maxWorkload}</span>
                            <span className="text-xs text-gray-500">Assigned / Maximum</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={getUtilizationBadge(employee.utilization) as any}>
                              {employee.utilization.toFixed(1)}%
                            </Badge>
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  employee.utilization >= 90
                                    ? "bg-green-600"
                                    : employee.utilization >= 70
                                    ? "bg-yellow-600"
                                    : "bg-red-600"
                                }`}
                                style={{ width: `${Math.min(employee.utilization, 100)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Employee Statistics Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Average Utilization</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {filteredEmployeeData.length > 0
                      ? (
                          filteredEmployeeData.reduce((sum, emp) => sum + emp.utilization, 0) /
                          filteredEmployeeData.length
                        ).toFixed(1)
                      : "0.0"}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Coverage Requests</p>
                  <p className="text-3xl font-bold text-orange-600">
                    {filteredEmployeeData.reduce((sum, emp) => sum + emp.coverageRequests, 0)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Absences</p>
                  <p className="text-3xl font-bold text-red-600">
                    {filteredEmployeeData.reduce((sum, emp) => sum + emp.absences, 0)}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Total Shifts Assigned</p>
                  <p className="text-3xl font-bold text-green-600">
                    {filteredEmployeeData.reduce((sum, emp) => sum + emp.totalShifts, 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
