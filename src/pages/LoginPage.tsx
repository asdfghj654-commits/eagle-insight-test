/**
 * Login Page ג€” Eagle Insight
 *
 * Two auth paths:
 * 1. Real API: POST /api/auth/login with personal-number + password
 *    Seeded users: 8234567 / 7123456 / 6012345 / 5001234, all password: "password"
 * 2. Dev quick-login: one-click role cards (dev mode only, no server required)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Shield, Lock, User, AlertCircle, Eye, EyeOff,
  Wrench, Settings, Crown, Loader2, Wifi, WifiOff, ChevronRight,
} from 'lucide-react';
import { useAuth, DEMO_USERS } from '@/contexts/AuthContext';
import { UserRole } from '@/types/core';

const LOGIN_TEXT = {
  roleTech: "\u05D8\u05DB\u05E0\u05D0\u05D9 \u05DE\u05D8\u05D5\u05E1\u05D9\u05DD",
  roleTechDesc: "\u05EA\u05D5\u05E8 \u05DE\u05E9\u05D9\u05DE\u05D5\u05EA \u00B7 \u05D0\u05D9\u05E9\u05D5\u05E8\u05D9 \u05DE\u05DE\u05E6\u05D0\u05D9\u05DD",
  roleSpec: "\u05E8\"\u05E6 \u05D0\u05D7\u05D6\u05E7\u05D4",
  roleSpecDesc: "\u05E0\u05D9\u05D4\u05D5\u05DC \u05DE\u05DE\u05E6\u05D0\u05D9\u05DD \u00B7 \u05E1\u05E7\u05D9\u05E8\u05EA \u05D8\u05D9\u05D9\u05E1\u05EA",
  roleEngineer: "\u05DE\u05D4\u05E0\u05D3\u05E1 \u05D0\u05D7\u05D6\u05E7\u05D4",
  roleEngineerDesc: "\u05D7\u05E7\u05D9\u05E8\u05EA \u05E1\u05D9\u05D2\u05E0\u05DC\u05D9\u05DD \u00B7 \u05E0\u05D9\u05D4\u05D5\u05DC \u05DB\u05DC\u05DC\u05D9\u05DD",
  roleCommander: "\u05E7\u05E6\u05D9\u05DF \u05D8\u05DB\u05E0\u05D9",
  roleCommanderDesc: "\u05DB\u05E9\u05D9\u05E8\u05D5\u05EA \u05D8\u05D9\u05D9\u05E1\u05EA \u00B7 \u05E0\u05D9\u05D4\u05D5\u05DC \u05E1\u05D9\u05DB\u05D5\u05E0\u05D9\u05DD",
  seedTech: "\u05D8\u05DB\u05E0\u05D0\u05D9",
  seedSpec: "\u05E8\"\u05E6",
  seedEngineer: "\u05DE\u05D4\u05E0\u05D3\u05E1",
  seedCommander: "\u05E7\u05E6\u05D9\u05DF \u05D8\u05DB\u05E0\u05D9",
  invalidCreds: "\u05DE\u05E1\u05E4\u05E8 \u05D0\u05D9\u05E9\u05D9 \u05D0\u05D5 \u05E1\u05D9\u05E1\u05DE\u05D4 \u05E9\u05D2\u05D5\u05D9\u05D9\u05DD",
  loginError: "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA. \u05D5\u05D3\u05D0 \u05E9\u05D4\u05E9\u05E8\u05EA \u05D4\u05DE\u05E7\u05D5\u05DE\u05D9 \u05E4\u05D5\u05E2\u05DC.",
  quickLoginError: "\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4",
  redirecting: "\u05DE\u05E2\u05D1\u05D9\u05E8 \u05D0\u05D5\u05EA\u05DA \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA...",
  enterSystem: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05DE\u05E2\u05E8\u05DB\u05EA",
  serverConnected: "\u05E9\u05E8\u05EA \u05DE\u05D7\u05D5\u05D1\u05E8",
  demoMode: "\u05DE\u05E6\u05D1 \u05D3\u05DE\u05D5",
  serverUnavailable: "\u05E9\u05E8\u05EA \u05DC\u05D0 \u05D6\u05DE\u05D9\u05DF",
  personalNumber: "\u05DE\u05E1\u05E4\u05E8 \u05D0\u05D9\u05E9\u05D9",
  password: "\u05E1\u05D9\u05E1\u05DE\u05D4",
  personalNumberExample: "\u05DC\u05DE\u05E9\u05DC: 8234567",
  passwordPlaceholder: "\u05D4\u05D6\u05DF \u05E1\u05D9\u05E1\u05DE\u05D4",
  connecting: "\u05DE\u05EA\u05D7\u05D1\u05E8...",
  login: "\u05D4\u05EA\u05D7\u05D1\u05E8",
  hideCreds: "\u05D4\u05E1\u05EA\u05E8 \u05E4\u05E8\u05D8\u05D9 \u05DB\u05E0\u05D9\u05E1\u05D4",
  showCreds: "\u05D4\u05E6\u05D2 \u05E4\u05E8\u05D8\u05D9 \u05DB\u05E0\u05D9\u05E1\u05D4 \u05DC\u05D1\u05D3\u05D9\u05E7\u05D4",
  sharedPassword: "\u05E1\u05D9\u05E1\u05DE\u05D4 \u05DC\u05DB\u05D5\u05DC\u05DD:",
  quickLoginDev: "\u05DB\u05E0\u05D9\u05E1\u05D4 \u05DE\u05D4\u05D9\u05E8\u05D4 \u2014 \u05E4\u05D9\u05EA\u05D5\u05D7 \u05D1\u05DC\u05D1\u05D3",
  footer: "\u05D7\u05D9\u05DC \u05D4\u05D0\u05D5\u05D5\u05D9\u05E8 \u05D4\u05D9\u05E9\u05E8\u05D0\u05DC\u05D9 \u2014 \u05E2\u05E0\u05E3 \u05D8\u05DB\u05E0\u05D9",
} as const;

// ג”€ג”€ Role configuration ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
const ROLE_CONFIG: Record<UserRole, {
  userId: string;
  labelHe: string;
  descHe: string;
  icon: React.ElementType;
  accentClass: string;
  borderClass: string;
  bgClass: string;
}> = {
  technician: {
    userId: 'tech001',
    labelHe: LOGIN_TEXT.roleTech,
    descHe: LOGIN_TEXT.roleTechDesc,
    icon: Wrench,
    accentClass: 'text-blue-400',
    borderClass: 'border-blue-500/40 hover:border-blue-400',
    bgClass: 'bg-blue-500/10 hover:bg-blue-500/15',
  },
  specialist: {
    userId: 'spec001',
    labelHe: LOGIN_TEXT.roleSpec,
    descHe: LOGIN_TEXT.roleSpecDesc,
    icon: Settings,
    accentClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/40 hover:border-emerald-400',
    bgClass: 'bg-emerald-500/10 hover:bg-emerald-500/15',
  },
  engineer: {
    userId: 'eng001',
    labelHe: LOGIN_TEXT.roleEngineer,
    descHe: LOGIN_TEXT.roleEngineerDesc,
    icon: Shield,
    accentClass: 'text-violet-400',
    borderClass: 'border-violet-500/40 hover:border-violet-400',
    bgClass: 'bg-violet-500/10 hover:bg-violet-500/15',
  },
  commander: {
    userId: 'cmd001',
    labelHe: LOGIN_TEXT.roleCommander,
    descHe: LOGIN_TEXT.roleCommanderDesc,
    icon: Crown,
    accentClass: 'text-amber-400',
    borderClass: 'border-amber-500/40 hover:border-amber-400',
    bgClass: 'bg-amber-500/10 hover:bg-amber-500/15',
  },
};

const ROLE_ORDER: UserRole[] = ['technician', 'specialist', 'engineer', 'commander'];

// ג”€ג”€ Seeded credentials table ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
const SEED_CREDENTIALS = [
  { roleHe: LOGIN_TEXT.seedTech, personalNumber: '8234567' },
  { roleHe: LOGIN_TEXT.seedSpec, personalNumber: '7123456' },
  { roleHe: LOGIN_TEXT.seedEngineer, personalNumber: '6012345' },
  { roleHe: LOGIN_TEXT.seedCommander, personalNumber: '5001234' },
];

// ג”€ג”€ Main component ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, devLoginAs, isAuthenticated, getDefaultRoute, isDevelopment, serverAvailable } = useAuth();

  const [personalNumber, setPersonalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState<UserRole | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);

  // Redirect once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setIsTransitioning(true);
      const t = setTimeout(() => navigate(getDefaultRoute(), { replace: true }), 280);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated, navigate, getDefaultRoute]);

  // ג”€ג”€ Form login ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const result = await login(personalNumber, password);
      if (!result.success) {
        setError(result.errorHe || LOGIN_TEXT.invalidCreds);
      }
    } catch {
      setError(LOGIN_TEXT.loginError);
    } finally {
      setIsLoading(false);
    }
  }, [login, personalNumber, password]);

  // ג”€ג”€ Dev quick-login ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  const handleQuickLogin = useCallback(async (role: UserRole) => {
    setLoadingRole(role);
    setError(null);
    try {
      devLoginAs(role);
    } catch {
      setError(LOGIN_TEXT.quickLoginError);
      setLoadingRole(null);
    }
  }, [devLoginAs]);

  // ג”€ג”€ Render ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden transition-opacity duration-300 ${isTransitioning ? 'opacity-60' : 'opacity-100'}`}
      style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #0f172a 100%)' }}
      dir="rtl"
    >
      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* Glow accent */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />

      {/* Transition overlay */}
      {isTransitioning && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 text-blue-400 animate-spin mx-auto" />
            <p className="text-blue-200 text-sm">{LOGIN_TEXT.redirecting}</p>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-md space-y-6">

        {/* ג”€ג”€ Branding ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-2xl relative"
            style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' }}>
            <Shield className="h-8 w-8 text-white" />
            <span className="absolute -bottom-1 -left-1 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-md text-blue-700 text-[10px] font-bold">מד</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Eagle Insight</h1>
              <p className="text-slate-400 text-sm mt-0.5">מערכת תובנות טיסה — המטה הטכנולוגי</p>
          </div>
        </div>

        {/* ג”€ג”€ Login card ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl overflow-hidden">

          {/* Card header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <span className="text-white font-semibold text-sm">{LOGIN_TEXT.enterSystem}</span>
            <div className="flex items-center gap-1.5 text-xs">
              {serverAvailable ? (
                <>
                  <Wifi className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-400">{LOGIN_TEXT.serverConnected}</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 text-amber-400" />
                  <span className="text-amber-400">{isDevelopment ? LOGIN_TEXT.demoMode : LOGIN_TEXT.serverUnavailable}</span>
                </>
              )}
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Error */}
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="personalNumber" className="text-slate-300 text-xs">{LOGIN_TEXT.personalNumber}</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="personalNumber"
                    type="text"
                    inputMode="numeric"
                    placeholder={LOGIN_TEXT.personalNumberExample}
                    value={personalNumber}
                    onChange={e => setPersonalNumber(e.target.value)}
                    className="pr-10 bg-white/5 border-white/20 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20"
                    disabled={isLoading}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-300 text-xs">{LOGIN_TEXT.password}</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={LOGIN_TEXT.passwordPlaceholder}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="pr-10 pl-10 bg-white/5 border-white/20 text-white placeholder:text-slate-600 focus:border-blue-500 focus:ring-blue-500/20"
                    disabled={isLoading}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium"
                size="lg"
                disabled={isLoading || !personalNumber || !password}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {LOGIN_TEXT.connecting}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4" />
                    {LOGIN_TEXT.login}
                  </span>
                )}
              </Button>
            </form>

            {/* Credentials hint (collapsible) */}
            {isDevelopment && (
              <div className="pt-1">
                <button
                  onClick={() => setShowCredentials(v => !v)}
                  className="text-xs text-slate-500 hover:text-slate-400 flex items-center gap-1 transition-colors w-full justify-center"
                >
                  {showCredentials ? LOGIN_TEXT.hideCreds : LOGIN_TEXT.showCreds}
                </button>
                {showCredentials && (
                  <div className="mt-2 rounded-lg border border-white/10 bg-white/5 overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-white/10 text-center">
                      {LOGIN_TEXT.sharedPassword} <code className="text-amber-400 font-mono font-bold">password</code>
                    </div>
                    <div className="divide-y divide-white/5">
                      {SEED_CREDENTIALS.map(c => (
                        <div key={c.personalNumber} className="flex items-center justify-between px-3 py-1.5 text-xs">
                          <span className="text-slate-400">{c.roleHe}</span>
                          <code className="text-slate-300 font-mono">{c.personalNumber}</code>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ג”€ג”€ Dev quick-login ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
        {isDevelopment && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-slate-500 whitespace-nowrap">{LOGIN_TEXT.quickLoginDev}</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ROLE_ORDER.map(role => {
                const cfg = ROLE_CONFIG[role];
                const user = DEMO_USERS[cfg.userId];
                if (!user) return null;
                const Icon = cfg.icon;
                const isThisLoading = loadingRole === role;
                return (
                  <button
                    key={role}
                    onClick={() => handleQuickLogin(role)}
                    disabled={isLoading || !!loadingRole}
                    className={`relative p-3.5 rounded-xl border text-right transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${cfg.borderClass} ${cfg.bgClass}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={`mt-0.5 p-1.5 rounded-lg bg-white/5 flex-shrink-0 ${cfg.accentClass}`}>
                        {isThisLoading
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Icon className="h-4 w-4" />
                        }
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold leading-tight ${cfg.accentClass}`}>
                          {cfg.labelHe}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                          {cfg.descHe}
                        </p>
                        <p className="text-[10px] text-slate-600 mt-1 font-mono">
                          {user.rankHe}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ג”€ג”€ Footer ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
        <p className="text-center text-xs text-slate-600">
          ֲ© {new Date().getFullYear()} {LOGIN_TEXT.footer}
          {isDevelopment && (
            <Badge variant="outline" className="mr-2 text-[10px] border-slate-700 text-slate-500">DEV</Badge>
          )}
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
