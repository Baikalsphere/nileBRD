"use client";

import { useState } from "react";
import { ButtonShadcn } from "@/components/ui/ButtonShadcn";
import { InputShadcn } from "@/components/ui/InputShadcn";
import { Label } from "@/components/ui/Label";
import { Sparkles, Users, Briefcase, Cpu, MonitorCheck, ArrowRight, CheckCircle2 } from "lucide-react";

type UserRole = "stakeholder" | "ba" | "it" | "it_member" | null;

const roleConfig = [
  { 
    id: "stakeholder", 
    title: "Stakeholder", 
    description: "Submit problems and request features",
    icon: Users,
    color: "from-blue-500 to-blue-600",
    benefits: ["Submit requirements", "Track project status", "Approve deliverables"]
  },
  { 
    id: "ba", 
    title: "Business Analyst", 
    description: "Analyze requirements and create FRDs",
    icon: Briefcase,
    color: "from-purple-500 to-purple-600",
    benefits: ["Create specifications", "Manage requirements", "Review documents"]
  },
  {
    id: "it",
    title: "IT Manager",
    description: "Manage BRDs, FRDs, test cases and the full IT pipeline",
    icon: Cpu,
    color: "from-green-500 to-green-600",
    benefits: ["Receive approved BRDs", "Generate FRDs & test cases", "Oversee deployments"]
  },
  {
    id: "it_member",
    title: "IT Team Member",
    description: "Execute SIT/UAT testing, track development and deployments",
    icon: MonitorCheck,
    color: "from-cyan-500 to-cyan-600",
    benefits: ["Run SIT & UAT tests", "Track development tasks", "Update deployment status"]
  },
];

export default function SignupPage() {
  const [step, setStep] = useState<"form" | "role">("form");
  const [formData, setFormData] = useState({ email: "", password: "", confirmPassword: "" });
  const [selectedRole, setSelectedRole] = useState<UserRole>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setStep("role");
  };

  const handleRoleSelect = async (role: UserRole) => {
    if (!role) return;
    
    setSelectedRole(role);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          role: role,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Signup failed");
        setIsLoading(false);
      } else {
        // Cookies set by the API route — redirect to the correct portal
        const rolePortals: Record<string, string> = {
          stakeholder: "/stakeholder",
          ba: "/ba",
          it: "/it",
          it_member: "/it-member",
        };
        setTimeout(() => {
          window.location.href = rolePortals[data.user.role] ?? "/";
        }, 800);
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      console.error(err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-20" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl opacity-20" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 text-lg font-semibold mb-12">
          <div className="size-10 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">BPRM Portal</span>
        </div>

        {step === "form" ? (
          <>
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold tracking-tight mb-3 text-white">Create Your Account</h1>
              <p className="text-slate-400 text-base">Join our platform and start collaborating today</p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6 bg-slate-800/50 backdrop-blur-xl p-8 rounded-2xl border border-slate-700/50 shadow-2xl">
              <div className="space-y-3">
                <Label htmlFor="email" className="text-sm font-semibold text-slate-200">Email Address</Label>
                <InputShadcn
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => handleFormChange("email", e.target.value)}
                  required
                  className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="password" className="text-sm font-semibold text-slate-200">Password</Label>
                <InputShadcn
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => handleFormChange("password", e.target.value)}
                  required
                  className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                />
                <p className="text-xs text-slate-400">At least 6 characters</p>
              </div>

              <div className="space-y-3">
                <Label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-200">Confirm Password</Label>
                <InputShadcn
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={(e) => handleFormChange("confirmPassword", e.target.value)}
                  required
                  className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-primary"
                />
              </div>

              {error && (
                <div className="p-4 text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg flex items-start gap-3">
                  <div className="mt-0.5 size-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="size-2 rounded-full bg-red-500" />
                  </div>
                  {error}
                </div>
              )}

              <ButtonShadcn type="submit" className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg" size="lg">
                Continue to Role Selection
                <ArrowRight className="ml-2 size-4" />
              </ButtonShadcn>

              <div className="text-center text-sm text-slate-400">
                Already have an account?{" "}
                <a href="/" className="text-primary font-semibold hover:text-primary/80 transition-colors">
                  Log in
                </a>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold tracking-tight mb-3 text-white">Select Your Role</h1>
              <p className="text-slate-400 text-base">Choose how you'll use our platform</p>
            </div>

            <div className="space-y-4">
              {roleConfig.map((role) => {
                const Icon = role.icon;
                const isSelected = selectedRole === role.id;
                const isExpanded = expandedRole === role.id;

                return (
                  <button
                    key={role.id}
                    onClick={() => {
                      setExpandedRole(isExpanded ? null : role.id);
                    }}
                    type="button"
                    className={`w-full text-left transition-all duration-300 rounded-xl border-2 p-6 ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-slate-700/50 bg-slate-800/30 hover:border-primary/50 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-lg bg-gradient-to-br ${role.color} text-white flex-shrink-0`}>
                          <Icon className="size-6" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-lg text-white">{role.title}</h3>
                          <p className="text-sm text-slate-400 mt-1">{role.description}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="size-6 text-primary flex-shrink-0 ml-2" />
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-700/50 space-y-2">
                        {role.benefits.map((benefit, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-slate-300">
                            <div className="size-2 rounded-full bg-primary" />
                            {benefit}
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}

              {error && (
                <div className="p-4 text-sm text-red-300 bg-red-950/40 border border-red-900/50 rounded-lg flex items-start gap-3">
                  <div className="mt-0.5 size-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="size-2 rounded-full bg-red-500" />
                  </div>
                  {error}
                </div>
              )}

              {selectedRole && (
                <ButtonShadcn 
                  onClick={() => handleRoleSelect(selectedRole)}
                  disabled={isLoading}
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg"
                >
                  {isLoading ? "Creating account..." : "Create Account"}
                  {!isLoading && <ArrowRight className="ml-2 size-4" />}
                </ButtonShadcn>
              )}

              <ButtonShadcn 
                onClick={() => setStep("form")} 
                variant="outline" 
                className="w-full h-12 border-slate-700 hover:bg-slate-800 text-slate-200" 
                disabled={isLoading}
              >
                Back
              </ButtonShadcn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
