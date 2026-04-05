import { Button } from "@/components/ui/button";
import { Download, Database } from "lucide-react";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useToast } from "@/hooks/use-toast";

interface DemoDataButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export const DemoDataButton = ({ 
  variant = "outline", 
  size = "sm", 
  className = "" 
}: DemoDataButtonProps) => {
  const isDemoEnabled = import.meta.env.DEV;
  const { loadDemoData, processedFlights } = useCSVData();
  const hasData = processedFlights.length > 0;
  const { toast } = useToast();

  if (!isDemoEnabled) {
    return null;
  }

  const handleLoadDemo = async () => {
    try {
      await loadDemoData();
      toast({
        title: "נתוני דמו נטענו בהצלחה",
        description: "7 ימי נתונים • 5 מטוסים • 105 טיסות",
      });
    } catch (error) {
      toast({
        title: "שגיאה בטעינת נתוני דמו",
        description: "נסה שוב",
        variant: "destructive",
      });
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleLoadDemo}
      className={`flex items-center gap-2 ${className}`}
    >
      {hasData ? (
        <>
          <Database className="h-4 w-4" />
          רענן נתוני דמו
        </>
      ) : (
        <>
          <Download className="h-4 w-4" />
          טען נתוני דמו
        </>
      )}
    </Button>
  );
};
