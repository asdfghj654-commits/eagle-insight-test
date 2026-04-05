import React, { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  BarChart3, 
  TrendingUp, 
  AlertTriangle, 
  Target,
  Calculator,
  Sigma 
} from 'lucide-react';

interface StatsBarProps {
  data: any[];
  parameters: string[];
}

export const StatsBar: React.FC<StatsBarProps> = ({ data, parameters }) => {
  const statistics = useMemo(() => {
    if (!data.length || !parameters.length) return null;

    const stats: any = {};

    parameters.forEach(param => {
      const values = data
        .map(d => d[param])
        .filter(v => v !== undefined && v !== null && !isNaN(v))
        .map(v => parseFloat(v));

      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const std = Math.sqrt(variance);
        
        const q1Index = Math.floor(sorted.length * 0.25);
        const q3Index = Math.floor(sorted.length * 0.75);
        const iqr = sorted[q3Index] - sorted[q1Index];
        
        // Outlier detection using IQR method
        const lowerFence = sorted[q1Index] - 1.5 * iqr;
        const upperFence = sorted[q3Index] + 1.5 * iqr;
        const outliers = values.filter(v => v < lowerFence || v > upperFence);

        stats[param] = {
          count: values.length,
          mean: mean,
          std: std,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          median: sorted[Math.floor(sorted.length / 2)],
          q1: sorted[q1Index],
          q3: sorted[q3Index],
          iqr: iqr,
          outliers: outliers.length,
          outlierPercentage: (outliers.length / values.length) * 100,
          // Suggested thresholds
          thresholds: {
            twoSigma: { lower: mean - 2 * std, upper: mean + 2 * std },
            threeSigma: { lower: mean - 3 * std, upper: mean + 3 * std },
            p95: sorted[Math.floor(sorted.length * 0.95)],
            p99: sorted[Math.floor(sorted.length * 0.99)]
          }
        };
      }
    });

    return stats;
  }, [data, parameters]);

  const handleSuggestThreshold = (parameter: string, type: string) => {
    const stat = statistics?.[parameter];
    if (!stat) return;

    let threshold;
    switch (type) {
      case '2sigma':
        threshold = `${stat.thresholds.twoSigma.lower.toFixed(2)} - ${stat.thresholds.twoSigma.upper.toFixed(2)}`;
        break;
      case '3sigma':
        threshold = `${stat.thresholds.threeSigma.lower.toFixed(2)} - ${stat.thresholds.threeSigma.upper.toFixed(2)}`;
        break;
      case 'p95':
        threshold = `< ${stat.thresholds.p95.toFixed(2)}`;
        break;
      case 'p99':
        threshold = `< ${stat.thresholds.p99.toFixed(2)}`;
        break;
    }

    // In a real implementation, this would open a rule creation dialog
    console.log(`Suggested threshold for ${parameter}: ${threshold}`);
  };

  if (!statistics || !parameters.length) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="text-center text-muted-foreground text-sm">
            <Calculator className="h-6 w-6 mx-auto mb-2 opacity-50" />
            בחר נתונים לצפייה בסטטיסטיקות
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="text-sm font-medium">סטטיסטיקות נתונים</span>
          </div>
          <Badge variant="outline" className="text-xs">
            {data.length} נקודות נבחרות
          </Badge>
        </div>

        <div className="space-y-4">
          {parameters.map(param => {
            const stat = statistics[param];
            if (!stat) return null;

            return (
              <div key={param} className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{param}</span>
                  {stat.outlierPercentage > 5 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {stat.outlierPercentage.toFixed(1)}% חריגים
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-6 gap-2 text-xs">
                  <div className="text-center">
                    <div className="text-muted-foreground">N</div>
                    <div className="font-mono">{stat.count}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">μ</div>
                    <div className="font-mono">{stat.mean.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">σ</div>
                    <div className="font-mono">{stat.std.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Min</div>
                    <div className="font-mono">{stat.min.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Max</div>
                    <div className="font-mono">{stat.max.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground">Med</div>
                    <div className="font-mono">{stat.median.toFixed(2)}</div>
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-2">הצעות ספים:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => handleSuggestThreshold(param, '2sigma')}
                  >
                    <Sigma className="h-3 w-3 mr-1" />
                    μ±2σ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => handleSuggestThreshold(param, '3sigma')}
                  >
                    <Sigma className="h-3 w-3 mr-1" />
                    μ±3σ
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => handleSuggestThreshold(param, 'p95')}
                  >
                    <Target className="h-3 w-3 mr-1" />
                    P95
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-xs px-2"
                    onClick={() => handleSuggestThreshold(param, 'p99')}
                  >
                    <Target className="h-3 w-3 mr-1" />
                    P99
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};