import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { CSVDataProvider } from "@/contexts/CSVDataContext";
import { RoleProvider } from "@/components/dashboard/RoleProvider";
import { FlightDossierProvider } from "@/contexts/FlightDossierContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserRole } from "@/types/core";
import React, { useEffect } from "react";

// Pages
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EngineeringPortal from "./pages/EngineeringPortal";
import CommanderView from "./pages/CommanderView";
import LoginPage from "./pages/LoginPage";
import Review from "./pages/Review";
import ReportsPage from "./pages/ReportsPage";

const queryClient = new QueryClient();

// =============================================================================
// ROUTE REDIRECT BASED ON ROLE
// =============================================================================

const RoleBasedRedirect: React.FC = () => {
  const { user, isAuthenticated, isLoading, getDefaultRoute } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        navigate(getDefaultRoute(), { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [isAuthenticated, isLoading, navigate, getDefaultRoute]);
  
  // Show loading while determining redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl mb-4 mx-auto flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
        </div>
        <h2 className="text-lg font-semibold mb-1">מגן דוד לאחזקה</h2>
        <p className="text-muted-foreground text-sm">טוען...</p>
      </div>
    </div>
  );
};

// =============================================================================
// PROTECTED ROUTE WRAPPER
// =============================================================================

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles }) => {
  const { isAuthenticated, isLoading, hasRole, getDefaultRoute } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-xl mb-4 mx-auto flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
          <h2 className="text-lg font-semibold mb-1">מגן דוד לאחזקה</h2>
          <p className="text-muted-foreground text-sm">טוען...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !hasRole(roles)) {
    return <Navigate to={getDefaultRoute()} replace />;
  }

  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
};

// =============================================================================
// MAIN APP
// =============================================================================

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <RoleProvider>
        <FlightDossierProvider>
          <CSVDataProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Routes>
                  {/* Public Routes */}
                  <Route path="/login" element={<LoginPage />} />
                  
                  {/* Root - redirect based on role */}
                  <Route path="/" element={<RoleBasedRedirect />} />
                  
                  {/* Technician Routes */}
                  <Route 
                    path="/tech/queue" 
                    element={
                      <ProtectedRoute roles={['technician']}>
                        <Index />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/tech/my-tasks" 
                    element={
                      <ProtectedRoute roles={['technician']}>
                        <Index />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Specialist / Lead Routes - accessible by specialist and above */}
                  <Route 
                    path="/lead/triage" 
                    element={<Navigate to="/lead/fleet" replace />}
                  />
                  <Route 
                    path="/lead/fleet" 
                    element={
                      <ProtectedRoute roles={['technician', 'specialist', 'engineer', 'commander']}>
                        <Index />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/lead/reports" 
                    element={
                      <ProtectedRoute roles={['technician', 'specialist', 'engineer', 'commander']}>
                        <ReportsPage />
                      </ProtectedRoute>
                    } 
                  />
                  
                  {/* Engineer Routes - also accessible by commander for oversight */}
                  <Route 
                    path="/portal/magen-achzaka-david" 
                    element={<Navigate to="/portal/data-research" replace />}
                  />
                  <Route 
                    path="/portal/data-research" 
                    element={
                      <ProtectedRoute roles={['engineer']}>
                        <EngineeringPortal />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/engineer/rules" 
                    element={
                      <ProtectedRoute roles={['specialist', 'engineer', 'commander']}>
                        <Index />
                      </ProtectedRoute>
                    }
                  />
                  <Route 
                    path="/engineer/dashboard" 
                    element={
                      <ProtectedRoute roles={['engineer']}>
                        <Index />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/engineer/investigation" 
                    element={<Navigate to="/portal/data-research" replace />}
                  />
                  {/* Commander Routes */}
                  <Route 
                    path="/commander" 
                    element={
                      <ProtectedRoute roles={['commander']}>
                        <CommanderView />
                      </ProtectedRoute>
                    } 
                  />
                  <Route 
                    path="/commander/analytics" 
                    element={<Navigate to="/commander" replace />}
                  />
                  
                  {/* Rules review page — accessible to engineers and commanders */}
                  <Route
                    path="/review"
                    element={
                      <ProtectedRoute roles={['engineer', 'specialist', 'commander']}>
                        <Review />
                      </ProtectedRoute>
                    }
                  />

                  {/* Legacy route - redirect to role-based */}
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  
                  {/* 404 */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </CSVDataProvider>
        </FlightDossierProvider>
      </RoleProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
