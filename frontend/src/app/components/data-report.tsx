import { useState } from "react";
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

interface EmployeeData {
  id: string;
  name: string;
  totalShifts: number;
  coverageRequests: number;
  absences: number;
  maxWorkload: number;
  assignedWorkload: number;
  utilization: number;
}

export function DataReport() {
  const [timePeriod, setTimePeriod] = useState("this-month");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");

  // Mock data for General Overview
  const [generalData] = useState({
    totalAbsences: 23,
    totalCoverageRequests: 45,
    approvedCoverageRequests: 38,
    pendingCoverageRequests: 7,
    totalShifts: 280,
    filledShifts: 265,
    vacantShifts: 15,
  });

  // Mock data for Employee Overview
  const [employeeData] = useState<EmployeeData[]>([
    { id: "1", name: "John Smith", totalShifts: 18, coverageRequests: 2, absences: 1, maxWorkload: 20, assignedWorkload: 18, utilization: 90 },
    { id: "2", name: "Sarah Johnson", totalShifts: 22, coverageRequests: 1, absences: 0, maxWorkload: 24, assignedWorkload: 22, utilization: 91.7 },
    { id: "3", name: "Mike Davis", totalShifts: 20, coverageRequests: 3, absences: 2, maxWorkload: 20, assignedWorkload: 20, utilization: 100 },
    { id: "4", name: "Emma Wilson", totalShifts: 16, coverageRequests: 4, absences: 3, maxWorkload: 20, assignedWorkload: 16, utilization: 80 },
    { id: "5", name: "Alice Brown", totalShifts: 19, coverageRequests: 0, absences: 0, maxWorkload: 20, assignedWorkload: 19, utilization: 95 },
    { id: "6", name: "Bob Chen", totalShifts: 12, coverageRequests: 5, absences: 4, maxWorkload: 20, assignedWorkload: 12, utilization: 60 },
  ]);

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

  const exportReport = () => {
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
                          {((generalData.filledShifts / generalData.totalShifts) * 100).toFixed(1)}%
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
                          {((generalData.approvedCoverageRequests / generalData.totalCoverageRequests) * 100).toFixed(1)}%
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
                          {(generalData.totalAbsences / employeeData.length).toFixed(1)}
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
                      <TableHead>Coverage Requests</TableHead>
                      <TableHead>Absences</TableHead>
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
                          <Badge variant={employee.coverageRequests > 2 ? "destructive" : "secondary"}>
                            {employee.coverageRequests}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={employee.absences > 2 ? "destructive" : "secondary"}>
                            {employee.absences}
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
                    {(filteredEmployeeData.reduce((sum, emp) => sum + emp.utilization, 0) / filteredEmployeeData.length).toFixed(1)}%
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
