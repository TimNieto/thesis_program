// src/app/components/login-page.tsx

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Calendar } from "lucide-react";

interface LoginPageProps {
  onLogin: (username: string, role: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    // Mock authentication - in real app, this would validate against a backend
    try {
      const response = await fetch("https://thesisprogram-production.up.railway.app/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: username,
          password: password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Login failed");
      return;
    }

    onLogin(username.trim().toLowerCase(), data.role);

    } catch (err) {
      setError("Server not reachable");
    }
  };

  return (
    <div className="size-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Calendar className="size-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl text-center">Schedule Manager</CardTitle>
          <CardDescription className="text-center">
            Sign in to manage schedules and cover requests
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <div className="text-sm text-red-600">
                {error}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}