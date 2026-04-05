/**
 * Flight Technique Analysis Component
 * 
 * PRODUCTION RULE: This component MUST NOT display any data
 * until real analysis data exists. NO fake pilot names.
 * 
 * Commander-only view that shows flight technique patterns
 * derived from actual CSV data analysis.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plane, EyeOff, Database, Info } from "lucide-react";
import { useRole } from "./RoleProvider";
import { useDashboardData } from "@/hooks/useDashboardData";

export const FlightTechniqueAnalysis = () => {
  const { currentUser } = useRole();
  const { hasData, dashboardStats } = useDashboardData();

  // Only show to commander
  if (currentUser.role !== 'commander') {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-muted-foreground">
            <EyeOff className="h-5 w-5" />
            ניתוח טכניקת טיסה והתאמה למשימה
          </CardTitle>
          <CardDescription>
            תצוגה זמינה למפקד בלבד
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <EyeOff className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>אין לך הרשאה לצפות בתוכן זה</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // PRODUCTION: Show empty state if no data
  if (!hasData) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5 text-muted-foreground" />
            ניתוח טכניקת טיסה והתאמה למשימה
          </CardTitle>
          <CardDescription>
            ניתוח מפורט של טכניקת הטיסה והתאמתה לאופי המשימה - למפקד בלבד
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Database className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg">אין נתוני טכניקת טיסה</h3>
            <p className="text-muted-foreground mt-2">
              נדרשת העלאת נתוני קופסה שחורה לניתוח טכניקת טיסה
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show info that this feature requires integration
  return (
    <Card className="border-accent/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plane className="h-5 w-5 text-accent" />
          ניתוח טכניקת טיסה והתאמה למשימה
        </CardTitle>
        <CardDescription>
          ניתוח מפורט של טכניקת הטיסה והתאמתה לאופי המשימה - למפקד בלבד
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Info className="h-12 w-12 mx-auto text-blue-500 mb-4" />
          <h3 className="font-semibold text-lg">ניתוח טכניקת טיסה</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            נותחו {dashboardStats.totalFlights} טיסות.
            <br />
            ניתוח טכניקת טיסה מפורט דורש אינטגרציה עם מערכת הדרכה וסימולציה.
          </p>
        </div>
        <div className="mt-4 p-4 bg-muted/30 border rounded-lg">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• שמות טייסים אינם מוצגים לצורכי פרטיות</p>
            <p>• ניתוח טכניקה זמין לאחר אינטגרציה עם מערכת תדריכים</p>
            <p>• פנה למהנדס המטה לשילוב יכולת זו</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
