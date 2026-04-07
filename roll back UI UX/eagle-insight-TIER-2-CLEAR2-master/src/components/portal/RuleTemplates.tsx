import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Thermometer, Droplets, Zap, AlertTriangle, Check } from "lucide-react";
import { ActionButton, useActionToast } from "@/components/ui/shared-actions";
import { useState } from "react";

interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  severity: 'critical' | 'high' | 'medium' | 'low';
  conditions: Array<{
    parameter: string;
    type: string;
    value: string;
    operator: string;
  }>;
  system: string;
}

const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: 'engine_overheat',
    name: 'טמפרטורת מנוע גבוהה',
    description: 'זיהוי חריגה בטמפרטורת גזי פליטה',
    icon: <Thermometer className="h-4 w-4" />,
    severity: 'critical',
    conditions: [{
      parameter: 'egt_celsius',
      type: 'threshold',
      value: '650',
      operator: 'greater_than'
    }],
    system: 'מנוע'
  },
  {
    id: 'hydraulic_low',
    name: 'לחץ הידראולי נמוך',
    description: 'זיהוי ירידה בלחץ המערכת ההידראולית',
    icon: <Droplets className="h-4 w-4" />,
    severity: 'high',
    conditions: [{
      parameter: 'hydraulic_pressure_psi',
      type: 'threshold',
      value: '2800',
      operator: 'less_than'
    }],
    system: 'הידראוליקה'
  },
  {
    id: 'high_g_load',
    name: 'עומסי G יתר',
    description: 'זיהוי תמרונים בעומסי G גבוהים',
    icon: <Zap className="h-4 w-4" />,
    severity: 'medium',
    conditions: [{
      parameter: 'g_load',
      type: 'threshold',
      value: '7.5',
      operator: 'greater_than'
    }],
    system: 'מבנה'
  },
  {
    id: 'brake_overheat',
    name: 'התחממות בלמים',
    description: 'זיהוי טמפרטורת בלמים גבוהה',
    icon: <AlertTriangle className="h-4 w-4" />,
    severity: 'medium',
    conditions: [{
      parameter: 'brake_temp_celsius',
      type: 'threshold',
      value: '350',
      operator: 'greater_than'
    }],
    system: 'בלמים'
  }
];

interface RuleTemplatesProps {
  onSelectTemplate: (template: RuleTemplate) => void;
}

export const RuleTemplates = ({ onSelectTemplate }: RuleTemplatesProps) => {
  const { showSuccess } = useActionToast();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSeverityText = (severity: string) => {
    switch (severity) {
      case 'critical': return 'קריטי';
      case 'high': return 'גבוה';
      case 'medium': return 'בינוני';
      case 'low': return 'נמוך';
      default: return severity;
    }
  };

  const handleSelectTemplate = async (template: RuleTemplate, e?: React.MouseEvent) => {
    // Prevent double-triggering if clicking the button inside the card
    if (e) {
      e.stopPropagation();
    }
    
    setLoadingTemplate(template.id);
    try {
      // Small delay for visual feedback
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Call the parent handler
      onSelectTemplate(template);
      
      // Mark as selected
      setSelectedTemplate(template.id);
      
      // Show success message
      showSuccess(
        'תבנית נטענה',
        `התבנית "${template.name}" נטענה ל-Rule Composer`
      );
      
      // Clear selection after a moment
      setTimeout(() => setSelectedTemplate(null), 2000);
    } finally {
      setLoadingTemplate(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-right">תבניות כללים מוכנות</CardTitle>
        <CardDescription className="text-right">
          בחר תבנית כלל קיימת או התחל מאפס
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {RULE_TEMPLATES.map((template) => {
            const isSelected = selectedTemplate === template.id;
            const isLoading = loadingTemplate === template.id;
            
            return (
              <div
                key={template.id}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  isSelected 
                    ? 'bg-primary/10 border-primary' 
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex items-center justify-between" dir="rtl">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      isSelected 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-primary/10 text-primary'
                    }`}>
                      {isSelected ? <Check className="h-4 w-4" /> : template.icon}
                    </div>
                    <div>
                      <h4 className="font-medium">{template.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {template.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor(template.severity) as any}>
                      {getSeverityText(template.severity)}
                    </Badge>
                    <ActionButton 
                      variant="ghost" 
                      size="sm"
                      onClick={(e) => handleSelectTemplate(template, e as any)}
                      isLoading={isLoading}
                      loadingText="טוען..."
                    >
                      {isSelected ? 'נבחר ✓' : 'השתמש'}
                    </ActionButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};