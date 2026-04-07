import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, AlertTriangle, CheckCircle } from "lucide-react";

export const SystemExplanation = () => {
  return (
    <Card className="border-accent/20 bg-accent/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-accent" />
          הסבר ושימוש במערכת
        </CardTitle>
        <CardDescription>
          מידע חשוב לשימוש נכון ובטוח במערכת תובנות האחזקה
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-warning/20 bg-warning/5">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-warning-foreground">
            <strong>חשוב לזכור:</strong> מערכת זו היא כלי תומך בלבד ואינה מחליפה החלטה מקצועית. 
            כל תובנה חייבת להיבדק על ידי איש מקצוע מוסמך לפני ביצוע פעולה כלשהי.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              חובות המשתמש
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground pr-4">
              <li>• בדיקה מקצועית של כל תובנה</li>
              <li>• עדכון סטטוס טיפול</li>
              <li>• העברה לגורם מוסמך בעת הצורך</li>
              <li>• תיעוד פעולות שבוצעו</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              עקרונות התצוגה
            </h4>
            <ul className="text-sm space-y-1 text-muted-foreground pr-4">
              <li>• עיצוב צבעוני לפי רמת חומרה</li>
              <li>• הרשאות מותאמות לתפקיד</li>
              <li>• מעקב אחר תובנות חוזרות</li>
              <li>• זיהוי מגמות ודפוסים</li>
            </ul>
          </div>
        </div>

        <div className="bg-muted/30 rounded p-3">
          <h4 className="font-medium mb-2">סולם חומרה</h4>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-destructive rounded-full"></div>
              <span>קריטי - טיפול מיידי</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-warning rounded-full"></div>
              <span>בינוני - טיפול נדרש</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success rounded-full"></div>
              <span>קל - מעקב שוטף</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};