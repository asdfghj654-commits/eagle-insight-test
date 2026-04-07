import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Shield, Crown, Wrench, Settings } from "lucide-react";
import { useRole } from "./RoleProvider";

/**
 * UserInfoCard - Displays current user information
 * 
 * No role switching allowed - user identity comes from authentication.
 */
export const RoleSelector = () => {
  const { currentUser } = useRole();

  const getRoleIcon = () => {
    switch (currentUser.role) {
      case 'technician': return <User className="h-5 w-5" />;
      case 'maintenance-chief': return <Settings className="h-5 w-5" />;
      case 'engineer': return <Wrench className="h-5 w-5" />;
      case 'commander': return <Crown className="h-5 w-5" />;
      default: return <User className="h-5 w-5" />;
    }
  };

  const getRoleColor = () => {
    switch (currentUser.role) {
      case 'technician': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'maintenance-chief': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'engineer': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'commander': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          {getRoleIcon()}
          משתמש מחובר
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{currentUser.name}</p>
            <p className="text-sm text-muted-foreground">{currentUser.rank}</p>
          </div>
          <Badge className={getRoleColor()}>
            {currentUser.role === 'maintenance-chief' ? 'ר"צ' : 
             currentUser.role === 'engineer' ? 'מהנדס' :
             currentUser.role === 'commander' ? 'מפקד' : 'טכנאי'}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">מס׳ אישי: {currentUser.personalNumber || currentUser.id}</p>
      </CardContent>
    </Card>
  );
};