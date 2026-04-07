import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Play, Pause, AlertTriangle, CheckCircle } from "lucide-react";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useState } from "react";

export const ActiveRulesCard = () => {
  const { rules, toggleRuleActive } = useCSVData();

  const toggleRule = (ruleId: string) => {
    toggleRuleActive(ruleId);
  };

  const activeRules = rules.filter(rule => rule.status === 'approved' || rule.status === 'pending-review');
  const enabledCount = activeRules.filter(rule => rule.isActive).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="text-right">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5" />
              כללי אחזקה פעילים
            </CardTitle>
            <CardDescription>
              {activeRules.length} כללים זמינים • {enabledCount} פעילים
            </CardDescription>
          </div>
          <Button variant="outline" size="sm">
            ניהול כללים
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>אין כללים פעילים</p>
            <p className="text-sm">צור כללים בפורטל ההנדסי</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeRules.slice(0, 5).map((rule) => {
              const isEnabled = rule.isActive;
              const triggerCount = Math.floor(Math.random() * 10); // Mock trigger count
              
              return (
                <div key={rule.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between" dir="rtl">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{rule.name}</h4>
                        <Badge 
                          variant={rule.status === 'approved' ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {rule.status === 'approved' ? 'מאושר' : 'ממתין'}
                        </Badge>
                        <Badge 
                          variant={
                            rule.severity === 'critical' ? 'destructive' :
                            rule.severity === 'high' ? 'destructive' :
                            rule.severity === 'medium' ? 'default' : 'secondary'
                          }
                          className="text-xs"
                        >
                          {rule.severity === 'critical' ? 'קריטי' :
                           rule.severity === 'high' ? 'גבוה' :
                           rule.severity === 'medium' ? 'בינוני' : 'נמוך'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rule.description}
                      </p>
                      {isEnabled && (
                        <div className="flex items-center gap-2 mt-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          <span className="text-xs text-green-600">
                            {triggerCount} התעוררויות השבוע
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEnabled ? (
                        <Play className="h-3 w-3 text-green-500" />
                      ) : (
                        <Pause className="h-3 w-3 text-muted-foreground" />
                      )}
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={() => toggleRule(rule.id)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            
            {activeRules.length > 5 && (
              <>
                <Separator />
                <div className="text-center">
                  <Button variant="ghost" size="sm">
                    הצג עוד {activeRules.length - 5} כללים
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};