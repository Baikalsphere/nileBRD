"use client";

import { useState, useEffect } from "react";
import { ButtonShadcn } from "@/components/ui/ButtonShadcn";
import { InputShadcn } from "@/components/ui/InputShadcn";
import { Label } from "@/components/ui/Label";
import { Eye, EyeOff, Plus, Trash2, Shield, Users } from "lucide-react";

type UserRole = "stakeholder" | "ba" | "it";

interface User {
  id: number;
  email: string;
  role: UserRole;
  created_at: string;
}

export default function AdminPanel() {
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Create account form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("stakeholder");
  const [users, setUsers] = useState<User[]>([]);
  const [creatingUser, setCreatingUser] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Check if already authenticated
  useEffect(() => {
    const adminToken = localStorage.getItem("adminToken");
    const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || "ADMIN_SECRET_KEY_123";
    
    if (adminToken && adminToken === adminKey) {
      setIsAuthenticated(true);
      fetchUsers();
    }
    setIsInitialized(true);
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simple admin authentication - check against environment variable
    // In production, this would use a backend verification
    const adminKey = process.env.NEXT_PUBLIC_ADMIN_KEY || "ADMIN_SECRET_KEY_123";

    if (adminPassword === adminKey) {
      localStorage.setItem("adminToken", adminPassword);
      setIsAuthenticated(true);
      setAdminPassword("");
      fetchUsers();
    } else {
      setError("Invalid admin password");
    }

    setLoading(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreatingUser(true);

    if (!newEmail || !newPassword) {
      setError("Email and password required");
      setCreatingUser(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          role: selectedRole,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Failed to create user");
      } else {
        setSuccessMessage(`User ${newEmail} created successfully!`);
        setNewEmail("");
        setNewPassword("");
        setSelectedRole("stakeholder");
        await fetchUsers();
        setTimeout(() => setSuccessMessage(""), 3000);
      }
    } catch (err) {
      setError("Error creating user");
      console.error(err);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setIsAuthenticated(false);
    setAdminPassword("");
    setUsers([]);
  };

  // Not authenticated - show login form
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-slate-400">Initializing admin panel...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-12">
            <div className="size-10 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center shadow-lg">
              <Shield className="size-5 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-red-600 to-red-500 bg-clip-text text-transparent">
              Admin Panel
            </span>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-white">
              Restricted Access
            </h1>
            <p className="text-slate-400">Only administrators can proceed</p>
          </div>

          <form
            onSubmit={handleAdminLogin}
            className="space-y-6 bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl border border-slate-700/50 shadow-2xl"
          >
            <div className="space-y-3">
              <Label
                htmlFor="adminPassword"
                className="text-sm font-semibold text-slate-200"
              >
                Admin Password
              </Label>
              <div className="relative">
                <InputShadcn
                  id="adminPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="size-5" />
                  ) : (
                    <Eye className="size-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg">
                {error}
              </div>
            )}

            <ButtonShadcn
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg transition-all"
              size="lg"
              disabled={loading}
            >
              {loading ? "Verifying..." : "Access Admin Panel"}
            </ButtonShadcn>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated - show admin panel
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center">
              <Shield className="size-5 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white">Admin Control Panel</h1>
          </div>
          <ButtonShadcn
            onClick={handleLogout}
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            Logout
          </ButtonShadcn>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Create User Form */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-700/50 shadow-2xl space-y-6">
              <div className="flex items-center gap-2">
                <Plus className="size-5 text-red-500" />
                <h2 className="text-xl font-bold text-white">Create Account</h2>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-semibold text-slate-200">
                    Email
                  </Label>
                  <InputShadcn
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    className="h-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-semibold text-slate-200">
                    Password
                  </Label>
                  <InputShadcn
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-semibold text-slate-200">
                    Role
                  </Label>
                  <select
                    id="role"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="w-full h-10 bg-slate-700/50 border border-slate-600 text-white rounded-md px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500/20"
                  >
                    <option value="stakeholder">Stakeholder</option>
                    <option value="ba">Business Analyst</option>
                    <option value="it">IT Professional</option>
                  </select>
                </div>

                {error && (
                  <div className="p-3 text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="p-3 text-sm text-green-300 bg-green-950/40 border border-green-900/50 rounded-lg">
                    ✓ {successMessage}
                  </div>
                )}

                <ButtonShadcn
                  type="submit"
                  className="w-full h-10 text-sm font-semibold bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-lg"
                  disabled={creatingUser}
                >
                  {creatingUser ? "Creating..." : "Create User"}
                </ButtonShadcn>
              </form>
            </div>
          </div>

          {/* Active Users List */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 backdrop-blur-xl p-6 rounded-2xl border border-slate-700/50 shadow-2xl space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-5 text-blue-500" />
                  <h2 className="text-xl font-bold text-white">Active Accounts</h2>
                </div>
                <span className="text-sm bg-slate-700/50 text-slate-200 px-3 py-1 rounded-full">
                  {users.length} user{users.length !== 1 ? "s" : ""}
                </span>
              </div>

              {users.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="size-12 text-slate-600 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-400">No accounts created yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-3 px-4 font-semibold text-slate-200">
                          Email
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-200">
                          Role
                        </th>
                        <th className="text-left py-3 px-4 font-semibold text-slate-200">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr
                          key={user.id}
                          className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors"
                        >
                          <td className="py-3 px-4 text-slate-200">{user.email}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                                user.role === "stakeholder"
                                  ? "bg-blue-500/20 text-blue-300"
                                  : user.role === "ba"
                                    ? "bg-purple-500/20 text-purple-300"
                                    : "bg-green-500/20 text-green-300"
                              }`}
                            >
                              {user.role === "stakeholder"
                                ? "Stakeholder"
                                : user.role === "ba"
                                  ? "Business Analyst"
                                  : "IT Professional"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-xs">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
