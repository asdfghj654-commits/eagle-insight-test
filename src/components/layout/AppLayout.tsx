/**
 * App Layout - מגן דוד לאחזקה
 * 
 * Shared layout component that provides:
 * - Consistent header with user info
 * - Role-based navigation
 * - Logout functionality
 * - RTL support
 * - Desktop-optimized layout
 */

import React, { ReactNode, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Shield,
  LogOut,
  User,
  Settings,
  ChevronDown,
  LayoutDashboard,
  ClipboardList,
  Search,
  Wrench,
  Crown,
  BarChart3,
  FileText,
  AlertTriangle,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useFlightDossier } from '@/contexts/FlightDossierContext';
import { UserRole } from '@/types/core';

// =============================================================================
// NAVIGATION CONFIG PER ROLE
// =============================================================================

interface NavItem {
  label: string;
  labelHe: string;
  href: string;
  icon: React.ReactNode;
}

const ROLE_NAV_ITEMS: Record<UserRole, NavItem[]> = {
  technician: [
    { label: 'Task Queue', labelHe: 'תור משימות', href: '/tech/queue', icon: <ClipboardList className="h-4 w-4" /> },
    { label: 'My Tasks', labelHe: 'המשימות שלי', href: '/tech/my-tasks', icon: <Wrench className="h-4 w-4" /> },
    { label: 'Reports', labelHe: 'דוחות', href: '/lead/reports', icon: <FileText className="h-4 w-4" /> },
  ],
  specialist: [
    { label: 'Triage', labelHe: 'מיון ממצאים', href: '/lead/triage', icon: <AlertTriangle className="h-4 w-4" /> },
    { label: 'Fleet Status', labelHe: 'מצב טייסת', href: '/lead/fleet', icon: <LayoutDashboard className="h-4 w-4" /> },
    { label: 'Reports', labelHe: 'דוחות', href: '/lead/reports', icon: <FileText className="h-4 w-4" /> },
  ],
  engineer: [
    { label: 'Investigation', labelHe: 'תחקור', href: '/portal/magen-achzaka-david', icon: <Search className="h-4 w-4" /> },
    { label: 'Rule Management', labelHe: 'ניהול כללים', href: '/engineer/rules', icon: <Settings className="h-4 w-4" /> },
  ],
  commander: [
    { label: 'Fleet Readiness', labelHe: 'כשירות טייסת', href: '/commander', icon: <Shield className="h-4 w-4" /> },
    { label: 'Analytics', labelHe: 'אנליטיקס', href: '/commander/analytics', icon: <BarChart3 className="h-4 w-4" /> },
  ],
};

// =============================================================================
// USER MENU
// =============================================================================

const UserMenu: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!user) return null;

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'technician': return <Wrench className="h-4 w-4" />;
      case 'specialist': return <Settings className="h-4 w-4" />;
      case 'engineer': return <Shield className="h-4 w-4" />;
      case 'commander': return <Crown className="h-4 w-4" />;
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    // Small delay for smooth transition
    await new Promise(resolve => setTimeout(resolve, 200));
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="flex items-center gap-2 h-auto py-2">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                {getRoleIcon(user.role)}
              </div>
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium leading-tight">{user.nameHe}</p>
                <p className="text-xs text-muted-foreground leading-tight">{user.roleHe}</p>
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span>{user.nameHe}</span>
              <span className="text-xs font-normal text-muted-foreground">{user.rankHe} • {user.unitHe}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShowProfile(true)}>
            <User className="ml-2 h-4 w-4" />
            פרופיל
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowSettings(true)}>
            <Settings className="ml-2 h-4 w-4" />
            הגדרות
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} className="text-red-600">
            <LogOut className="ml-2 h-4 w-4" />
            התנתק
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Profile Dialog */}
      {showProfile && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setShowProfile(false)}>
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md mx-4" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">פרופיל משתמש</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowProfile(false)}>✕</Button>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-primary/20">
                  {getRoleIcon(user.role)}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{user.nameHe}</h3>
                  <p className="text-muted-foreground">{user.roleHe}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">מספר אישי</p>
                  <p className="font-mono font-medium">{user.personalNumber}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">דרגה</p>
                  <p className="font-medium">{user.rankHe}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">יחידה</p>
                  <p className="font-medium">{user.unitHe}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">תפקיד</p>
                  <p className="font-medium">{user.roleHe}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground text-sm mb-2">הרשאות</p>
                <div className="flex flex-wrap gap-1">
                  {user.permissions.slice(0, 5).map(p => (
                    <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                  ))}
                  {user.permissions.length > 5 && (
                    <Badge variant="outline" className="text-xs">+{user.permissions.length - 5}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center" onClick={() => setShowSettings(false)}>
          <div className="bg-background rounded-lg shadow-xl p-6 w-full max-w-md mx-4" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">הגדרות</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(false)}>✕</Button>
            </div>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">התראות</h3>
                <p className="text-sm text-muted-foreground">התראות פעילות על כל הממצאים</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">תצוגה</h3>
                <p className="text-sm text-muted-foreground">מצב בהיר / כהה יקבע אוטומטית לפי המערכת</p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">שפה</h3>
                <p className="text-sm text-muted-foreground">עברית (ברירת מחדל)</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowSettings(false)}>סגור</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// =============================================================================
// NAVIGATION
// =============================================================================

const Navigation: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return null;

  const navItems = (ROLE_NAV_ITEMS[user.role] || [])
    .filter((item) => {
      if (user.role === 'technician') return item.href !== '/tech/my-tasks';
      if (user.role === 'specialist') return item.href !== '/lead/triage';
      if (user.role === 'commander') return item.href !== '/commander/analytics';
      return true;
    })
    .map((item) => {
      if (user.role !== 'engineer') return item;
      if (item.href === '/portal/magen-achzaka-david') {
        return { ...item, href: '/portal/data-research' };
      }
      if (item.href === '/engineer/rules') {
        return { ...item, href: '/engineer/dashboard' };
      }
      return item;
    });

  return (
    <nav className="flex items-center gap-1">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
        
        return (
          <Link key={item.href} to={item.href}>
            <Button 
              variant={isActive ? 'secondary' : 'ghost'} 
              size="sm"
              className="flex items-center gap-2"
            >
              {item.icon}
              <span className="hidden md:inline">{item.labelHe}</span>
            </Button>
          </Link>
        );
      })}
    </nav>
  );
};

// =============================================================================
// EMERGENCY BANNER
// =============================================================================

const EmergencyBanner: React.FC = () => {
  const { user } = useAuth();
  const {
    emergencyMode,
    emergencyReason,
    emergencyActivatedAt,
    setEmergencyMode,
    canManageEmergencyMode,
  } = useFlightDossier();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const canManage = canManageEmergencyMode(user.role);

  const handleActivate = async () => {
    if (!reasonInput.trim()) return;
    setIsSubmitting(true);
    const result = await setEmergencyMode(true, reasonInput, user.id, user.role);
    setIsSubmitting(false);
    if (result.success) {
      setDialogOpen(false);
      setReasonInput('');
    } else {
      window.alert(result.errorHe || result.error);
    }
  };

  const handleDeactivate = async () => {
    setIsSubmitting(true);
    const result = await setEmergencyMode(false, emergencyReason || 'ביטול ידני של מצב חירום', user.id, user.role);
    setIsSubmitting(false);
    if (!result.success) {
      window.alert(result.errorHe || result.error);
    }
  };

  if (!emergencyMode && !canManage) return null;

  return (
    <>
      <div className={`px-4 py-2 text-sm ${emergencyMode ? 'bg-red-600 text-white' : 'border-b border-amber-200 bg-amber-50 text-amber-950'}`}>
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-right">
            {emergencyMode ? <AlertTriangle className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
            <div>
              <div className="font-medium">
                {emergencyMode ? 'מצב חירום פעיל — כל הפעולות מתועדפות' : 'מצב חירום זמין להפעלה על ידי מפקד'}
              </div>
              {emergencyMode && (
                <div className="text-xs text-white/85">
                  {emergencyReason ? `סיבה: ${emergencyReason}` : 'ללא סיבה מתועדת'}
                  {emergencyActivatedAt ? ` | הופעל: ${new Date(emergencyActivatedAt).toLocaleString('he-IL')}` : ''}
                </div>
              )}
            </div>
          </div>

          {canManage && (
            !emergencyMode ? (
                <Button size="sm" variant="destructive" onClick={() => setDialogOpen(true)} disabled={isSubmitting}>
                  <ShieldAlert className="ml-2 h-4 w-4" />
                  הפעלת מצב חירום
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/20" onClick={handleDeactivate} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'צא ממצב חירום'}
                </Button>
              )
            )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-600" />
              הפעלת מצב חירום
            </DialogTitle>
            <DialogDescription>
              מצב חירום משנה התנהגות המערכת לכל התפקידים: תיעדוף גבוה יותר, נראות גלובלית והתראות בולטות.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label htmlFor="global-emergency-reason">
              סיבה להפעלת מצב חירום <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="global-emergency-reason"
              rows={4}
              placeholder="תאר את הסיבה להפעלת מצב חירום..."
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
            />
          </div>

          <DialogFooter className="gap-2">
             <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
               ביטול
             </Button>
             <Button variant="destructive" disabled={!reasonInput.trim() || isSubmitting} onClick={handleActivate}>
               {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'הפעל מצב חירום'}
             </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// =============================================================================
// MAIN LAYOUT
// =============================================================================

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();

  // If not authenticated, just render children (login page handles itself)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Emergency Banner */}
      <EmergencyBanner />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shrink-0">
        <div className="w-full px-4 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand - מגן דוד לאחזקה */}
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center shadow-md relative">
                  <Shield className="h-5 w-5 text-white" />
                  <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                    <span className="text-blue-700 text-[8px] font-bold">✡</span>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold leading-tight">מגן דוד לאחזקה</h1>
                  <p className="text-xs text-muted-foreground leading-tight">תובנות מערכת לאחר טיסה</p>
                </div>
              </Link>
              
              <Separator orientation="vertical" className="h-8 hidden md:block" />
              
              {/* Navigation */}
              <Navigation />
            </div>

            {/* Right Side - User & Time */}
            <div className="flex items-center gap-4">
              {/* Current Time */}
              <div className="hidden lg:flex flex-col items-start border-l pl-4">
                <p className="text-sm font-mono leading-tight" suppressHydrationWarning>
                  {new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <p className="text-xs text-muted-foreground leading-tight" suppressHydrationWarning>
                  {new Date().toLocaleDateString('he-IL')}
                </p>
              </div>

              {/* User Menu */}
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Desktop optimized with full width */}
      <main className="flex-1 w-full px-4 lg:px-6 py-6 overflow-auto">
        <div className="w-full max-w-[1800px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AppLayout;
