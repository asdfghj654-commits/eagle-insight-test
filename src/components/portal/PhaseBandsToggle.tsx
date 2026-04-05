import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, Plane } from 'lucide-react';

interface PhaseBandsToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

const FLIGHT_PHASES = [
  { phase: 'taxi', color: 'hsl(220, 30%, 85%)', label: 'גלגול' },
  { phase: 'takeoff', color: 'hsl(30, 70%, 80%)', label: 'המראה' },
  { phase: 'climb', color: 'hsl(120, 50%, 80%)', label: 'עליה' },
  { phase: 'cruise', color: 'hsl(200, 60%, 80%)', label: 'שייוט' },
  { phase: 'descent', color: 'hsl(280, 50%, 80%)', label: 'ירידה' },
  { phase: 'landing', color: 'hsl(0, 50%, 80%)', label: 'נחיתה' },
];

export const PhaseBandsToggle: React.FC<PhaseBandsToggleProps> = ({ 
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
              id="phase-bands"
            />
            <label 
              htmlFor="phase-bands" 
              className="text-sm font-medium flex items-center gap-1"
            >
              <Layers className="h-4 w-4" />
              רצועות שלבי טיסה
            </label>
          </div>

          {enabled && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1 flex-wrap">
                {FLIGHT_PHASES.map(({ phase, color, label }) => (
                  <Badge 
                    key={phase}
                    variant="outline" 
                    className="text-xs px-2 py-0"
                    style={{ 
                      backgroundColor: color,
                      borderColor: color,
                      color: 'hsl(var(--foreground))'
                    }}
                  >
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