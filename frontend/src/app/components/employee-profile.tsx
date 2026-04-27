// src/app/components/employee-profile.tsx

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Button } from "@/app/components/ui/button";
import { Separator } from "@/app/components/ui/separator";
import { toast } from "sonner";
import { User, Mail, Phone, Shield, Lock, Save } from "lucide-react";


interface EmployeeProfileProps {
  userId: number;
  role: string;
  onProfileUpdated: () => void;
}

export function EmployeeProfile({ userId, role, onProfileUpdated }: EmployeeProfileProps) {
  // Mock initial data - in a real app, this would be fetched from the backend
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  // Password change states
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
  fetch(`https://thesisprogram-production.up.railway.app/employees/${userId}`)
    .then(res => res.json())
    .then(data => {
      setName(data.name || "");
      setEmail(data.email || "");
      setContactNumber(data.contactNumber || "");
    })
    .catch(() => {
      toast.error("Failed to load profile");
    });
}, [userId]);

  const handleSaveProfile = async () => {

    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    if (!contactNumber.trim()) {
      toast.error("Contact number cannot be empty");
      return;
    }

    setSavingProfile(true);

    try {
      const response = await fetch(`https://thesisprogram-production.up.railway.app/employees/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          contactNumber,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      toast.success("Profile updated successfully");
      onProfileUpdated();

    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim() || !newPassword.trim()) {
      toast.error("Fill all fields");
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.trim().length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (newPassword.trim().length > 72) {
      toast.error("Password cannot exceed 72 characters");
      return;
    }

    setChangingPassword(true);

    try {
      const res = await fetch(
        `https://thesisprogram-production.up.railway.app/employees/${userId}/password`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            currentPassword: currentPassword.trim(),
            newPassword: newPassword.trim()
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to change password");
      }

      toast.success("Password changed successfully");

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Profile Information Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            View and update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="size-4" />
              Name
            </Label>
            <Input
              id="name"
              value={name}
              disabled
              className="bg-gray-50 cursor-not-allowed"
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="size-4" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              disabled
              className="bg-gray-50 cursor-not-allowed"
            />
            <p className="text-sm text-gray-500">
              Email cannot be changed after account creation
            </p>
          </div>

          {/* Contact Number */}
          <div className="space-y-2">
            <Label htmlFor="contact" className="flex items-center gap-2">
              <Phone className="size-4" />
              Contact Number
            </Label>
            <Input
              id="contact"
              type="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="Enter your contact number"
            />
          </div>

          {/* Role (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="role" className="flex items-center gap-2">
              <Shield className="size-4" />
              Role
            </Label>
            <Input
              id="role"
              value={role}
              disabled
              className="bg-gray-50 cursor-not-allowed"
            />
            <p className="text-sm text-gray-500">
              Role is managed by administrators
            </p>
          </div>

          <Button onClick={handleSaveProfile} className="gap-2" disabled={savingProfile}>
            <Save className="size-4" />
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5" />
            Change Password
          </CardTitle>
          <CardDescription>
            Update your account password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="current-password">Current Password</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
            />
          </div>

          <Separator />

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter your new password"
            />
            <p className="text-sm text-gray-500">
              Must be at least 6 characters
            </p>
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm New Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
            />
          </div>

          <Button
            onClick={handleChangePassword}
            variant="secondary"
            className="gap-2"
            disabled={changingPassword}
          >
            <Lock className="size-4" />
            {changingPassword ? "Changing..." : "Change Password"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
