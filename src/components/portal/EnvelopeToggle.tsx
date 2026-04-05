import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Shield } from 'lucide-react';

interface EnvelopeToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const ENVELOPE_TYPES = [
  { 
    type: 'redline', 
    color: 'hsl(0, 70%, 60%)', 
    label: 'Redline',
    icon: AlertTriangle 
  },
  { 
    type: 'caution', 
    color: 'hsl(45, 80%, 60%)', 
    label: 'Caution',
    icon: AlertTriangle 
  },
  { 
    type: 'normal', 
    color: 'hsl(120, 50%, 60%)', 
    label: 'Normal',
    icon: Shield 
  },
];

export const EnvelopeToggle: React.FC<EnvelopeToggleProps> = ({ 
  enabled, 
  onToggle 
}) => {
  return (
    <Card className="w-fit">
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch 
              checked={enabled} 
              onCheckedChange={onToggle}
              id="envelopes"
            />
            <label 
              htmlFor="envelopes" 
              className="text-sm font-medium flex items-center gap-1"
            >
              <Shield className="h-4 w-4" />
              מעטפות תפעוליות
            </label>
          </div>

          {enabled && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1">
                {ENVELOPE_TYPES.map(({ type, color, label, icon: Icon }) => (
                  <Badge 
                    key={type}
                    variant="outline" 
                    className="text-xs px-2 py-0 flex items-center gap-1 min-w-[80px] text-center justify-center"
                    style={{ 
                      borderColor: color,
                      color: color
                    }}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                  </Badge>
                ))}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};