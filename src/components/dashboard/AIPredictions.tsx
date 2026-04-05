/**
 * AI Predictions Component
 * 
 * PRODUCTION RULE: AI predictions are NOT available.
 * This component shows an informative message that AI models
 * are not integrated in this version of the system.
 * 
 * When a real AI/ML model is integrated, this component
 * will display predictions derived from that model only.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, AlertCircle, Info } from "lucide-react";

export const AIPredictions = () => {
  // PRODUCTION: No AI models are currently integrated
  // This component provides transparency about system capabilities
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          תחזיות AI ומודלים חכמים
        </CardTitle>
        <CardDescription>
          ניתוח מתקדם וחיזויים על בסיס נתוני טיסה
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-8">
          <Info className="h-12 w-12 mx-auto text-blue-500 mb-4" />
          <h3 className="font-semibold text-lg">יכולת AI לא פעילה</h3>
          <p className="text-muted-foreground mt-2 max-w-md mx-auto">
            מודלי AI לחיזוי תחזוקה אינם משולבים בגרסה זו של המערכת.
            ניתוח מתבצע על בסיס כללי אחזקה מוגדרים בלבד.
          </p>
        </div>
        <div className="mt-4 p-4 bg-muted/30 border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">מידע</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• המערכת מזהה תובנות על בסיס כללים שהוגדרו על ידי מהנדס</p>
            <p>• כל תובנה נגזרת מנתוני קופסה שחורה אמיתיים שהועלו</p>
            <p>• לשילוב מודלי AI עתידיים, פנה למהנדס המטה</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
