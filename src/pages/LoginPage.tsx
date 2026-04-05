/**
 * Login Page - מגן דוד לאחזקה
 * 
 * Professional login page with:
 * - מגן דוד לאחזקה branding
 * - RTL support
 * - Demo user quick-login (dev only)
 * - Smooth transitions
 * - Form validation
 * - Loading states
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Shield,
  Lock,
  User,
  AlertCircle,
  Eye,
  EyeOff,
  Wrench,
  Settings,
  Crown,
  Loader2,
} from 'lucide-react';
import { useAuth, DEMO_USERS } from '@/contexts/AuthContext';
import { UserRole } from '@/types/core';

// =============================================================================
// DEMO USER CARDS (Dev only)
// =============================================================================

interface DemoUserCardProps {
  userId: string;
  onLogin: () => void;
  isLoading: boolean;
  loadingUserId: string | null;
}

const DemoUserCard: React.FC<DemoUserCardProps> = ({ userId, onLogin, isLoading, loadingUserId }) => {
  const user = DEMO_USERS[userId];
  if (!user) return null;

  const isThisLoading = isLoading && loadingUserId === userId;

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'technician': return <Wrench className="h-5 w-5" />;
      case 'specialist': return <Settings className="h-5 w-5" />;
      case 'engineer': return <Shield className="h-5 w-5" />;
      case 'commander': return <Crown className="h-5 w-5" />;
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'technician': return 'border-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900';
      case 'specialist': return 'border-green-300 bg-green-50 hover:bg-green-100 dark:bg-green-950 dark:hover:bg-green-900';
      case 'engineer': return 'border-purple-300 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950 dark:hover:bg-purple-900';
      case 'commander': return 'border-orange-300 bg-orange-50 hover:bg-orange-100 dark:bg-orange-950 dark:hover:bg-orange-900';
    }
  };

  return (
    <button
      onClick={onLogin}
      disabled={isLoading}
      className={`p-3 rounded-lg border-2 transition-all duration-200 text-right w-full ${getRoleColor(user.role)} disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-full bg-white/50 dark:bg-black/20">
          {isThisLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            getRoleIcon(user.role)
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{user.nameHe}</p>
          <p className="text-xs text-muted-foreground">{user.roleHe}</p>
        </div>
      </div>
    </button>
  );
};

// =============================================================================
// MAIN LOGIN PAGE
// =============================================================================

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, devLoginAs, isAuthenticated, getDefaultRoute, isDevelopment, authMode } = useAuth();
  
  // Form state
  const [personalNumber, setPersonalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Smooth redirect when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setIsTransitioning(true);
      // Smooth transition delay
      const timer = setTimeout(() => {
        navigate(getDefaultRoute(), { replace: true });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, navigate, getDefaultRoute]);

  // =============================================================================
  // HANDLERS
  // =============================================================================

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    setLoadingUserId(null);

    try {
      const result = await login(personalNumber, password);
      
      if (!result.success) {
        setError(result.errorHe || result.error || 'שגיאה בהתחברות');
        setIsLoading(false);
      }
    } catch (err) {
      setError('שגיאה בהתחברות למערכת');
      setIsLoading(false);
    }
  }, [login, personalNumber, password]);

  const handleDevLogin = useCallback(async (role: UserRole, userId: string) => {
    setIsLoading(true);
    setLoadingUserId(userId);
    setError(null);
    
    try {
      // devLoginAs sets the user synchronously; navigation happens via useEffect
      devLoginAs(role);
    } catch (err) {
      setError('שגיאה בהתחברות');
      setIsLoading(false);
      setLoadingUserId(null);
    }
  }, [devLoginAs]);

  // =============================================================================
  // RENDER
  // =============================================================================

  const isAuthReady = authMode === 'api' || authMode === 'demo';

  return (
    <div 
      className={`relative min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4 transition-opacity duration-300 ${isTransitioning ? 'opacity-80' : 'opacity-100'}`} 
      dir="rtl"
    >
      {/* Background pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAzMHYySDI0di0yaDEyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />

      {isTransitioning && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl mb-4 mx-auto flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
            <p className="text-blue-100 text-sm">מעביר אותך למערכת...</p>
          </div>
        </div>
      )}
      
      <div className="relative w-full max-w-md">
        {/* Logo & Title - מגן דוד לאחזקה */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl mb-4 relative">
            <Shield className="h-10 w-10 text-white" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-md">
              <span className="text-blue-700 text-xs font-bold">✡</span>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">מגן דוד לאחזקה</h1>
          <p className="text-blue-200">מערכת תובנות מערכת לאחר טיסה</p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">כניסה למערכת</CardTitle>
            <CardDescription>הזן את פרטי ההזדהות שלך</CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {authMode !== 'demo' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  סביבת PROD מחייבת הזדהות חיצונית מוגדרת. פנה למנהל מערכת להגדרת ספק הזדהות.
                </AlertDescription>
              </Alert>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Personal Number */}
              <div className="space-y-2">
                <Label htmlFor="personalNumber">מספר אישי</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="personalNumber"
                    type="text"
                    placeholder="הזן מספר אישי"
                    value={personalNumber}
                    onChange={(e) => setPersonalNumber(e.target.value)}
                    className="pr-10"
                    disabled={isLoading || !isAuthReady}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-2">
                <Label htmlFor="password">סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="הזן סיסמה"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10 pl-10"
                    disabled={isLoading || !isAuthReady}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={!isAuthReady}
                />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                  זכור אותי
                </Label>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isLoading || !personalNumber || !password || !isAuthReady}
              >
                {isLoading && !loadingUserId ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>מתחבר...</span>
                  </div>
                ) : (
                  'התחבר'
                )}
              </Button>
            </form>

            {/* Dev Mode Quick Login - DEVELOPMENT ONLY */}
            {isDevelopment && authMode === 'demo' && (
              <>
                <div className="relative">
                  <Separator />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-orange-500 font-medium">
                    ⚠️ מצב פיתוח בלבד
                  </span>
                </div>

                <Alert className="bg-orange-50 dark:bg-orange-950 border-orange-200">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <AlertDescription className="text-xs text-orange-700 dark:text-orange-300">
                    כניסה מהירה זמינה רק במצב פיתוח. בסביבת ייצור, יש להשתמש בטופס התחברות.
                  </AlertDescription>
                </Alert>

                <div className="grid grid-cols-2 gap-3">
                  <DemoUserCard 
                    userId="tech001" 
                    onLogin={() => handleDevLogin('technician', 'tech001')}
                    isLoading={isLoading}
                    loadingUserId={loadingUserId}
                  />
                  <DemoUserCard 
                    userId="spec001" 
                    onLogin={() => handleDevLogin('specialist', 'spec001')}
                    isLoading={isLoading}
                    loadingUserId={loadingUserId}
                  />
                  <DemoUserCard 
                    userId="eng001" 
                    onLogin={() => handleDevLogin('engineer', 'eng001')}
                    isLoading={isLoading}
                    loadingUserId={loadingUserId}
                  />
                  <DemoUserCard 
                    userId="cmd001" 
                    onLogin={() => handleDevLogin('commander', 'cmd001')}
                    isLoading={isLoading}
                    loadingUserId={loadingUserId}
                  />
                </div>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    סיסמאות דמו: tech123 / spec123 / eng123 / cmd123
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-blue-300 mt-6">
          © 2024 חיל האוויר הישראלי - ענף טכני
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
