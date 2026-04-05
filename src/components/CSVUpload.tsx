import React, { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useCSVData } from "@/contexts/CSVDataContext";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useFlightDossier } from "@/contexts/FlightDossierContext";
import { useNavigate } from "react-router-dom";

interface CSVUploadProps {
  onUploadComplete?: () => void;
  navigateToAfterUpload?: string;
}

export const CSVUpload: React.FC<CSVUploadProps> = ({ onUploadComplete, navigateToAfterUpload }) => {
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{
    filename: string;
    rows: number;
    columns: number;
    headers: string[];
    sampleData: string[][];
  } | null>(null);

  const {
    uploadCSV,
    isProcessing,
    processingError,
    processingProgress,
    processingStage,
    rawData,
    processedFlights,
  } = useCSVData();
  const { toast } = useToast();
  const { user } = useAuth();
  const { refresh } = useFlightDossier();
  const navigate = useNavigate();
  const uploaderRole = user?.role ?? 'technician';

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "שגיאה",
        description: "יש לבחור קובץ CSV בלבד",
        variant: "warning",
      });
      return;
    }

    try {
      // Generate preview first
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      const sampleData = lines.slice(1, 11).map(line => 
        line.split(',').map(cell => cell.trim()).slice(0, 8)
      );

      setPreview({
        filename: file.name,
        rows: lines.length - 1,
        columns: headers.length,
        headers: headers.slice(0, 8),
        sampleData,
      });

      // Process the file
      await uploadCSV(file, uploaderRole);
      await refresh();
      
      if (onUploadComplete) {
        onUploadComplete();
      }

      if (navigateToAfterUpload) {
        navigate(navigateToAfterUpload);
      }

      toast({
        title: "הצלחה",
        description: `נטען קובץ ${file.name} - ${lines.length - 1} רשומות, ${headers.length} עמודות`,
        variant: "success",
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : 'שגיאה בהעלאת הקובץ';
      toast({
        title: "שגיאה",
        description: message,
        variant: "destructive",
      });
    }
  }, [uploadCSV, toast, onUploadComplete, uploaderRole, refresh, navigateToAfterUpload, navigate]);

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div className="space-y-4" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            טעינת קובץ CSV
          </CardTitle>
          <CardDescription>
            העלו קובץ CSV עם נתוני טיסה לניתוח. הקובץ חייב לכלול: flight_id, tail_number, timestamp, phase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <div className="w-full max-w-md space-y-2">
                  <Progress value={processingProgress ?? 0} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span aria-live="polite">
                      {processingStage || 'מעבד קובץ...'}
                    </span>
                    {processingProgress !== null && (
                      <span>{processingProgress}%</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-lg font-medium">גרור קובץ CSV או לחץ לבחירה</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    קבצים נתמכים: CSV עד 20MB
                  </p>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button asChild>
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      בחר קובץ
                      <input
                        id="csv-upload"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileInput}
                      />
                    </label>
                  </Button>
                </div>
              </div>
            )}
          </div>

          {processingError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{processingError}</AlertDescription>
            </Alert>
          )}

          {rawData.length > 0 && processedFlights.length > 0 && (
            <Alert className="mt-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                נטענו בהצלחה {rawData.length} רשומות מ-{processedFlights.length} טיסות
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">תצוגה מקדימה - {preview.filename}</CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary">{preview.rows} רשומות</Badge>
              <Badge variant="secondary">{preview.columns} עמודות</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse border border-border">
                <thead>
                  <tr>
                    {preview.headers.map((header, index) => (
                      <th key={index} className="border border-border p-2 bg-muted font-medium text-right">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleData.slice(0, 10).map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/50'}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="border border-border p-2 text-right">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.rows > 10 && (
              <p className="text-sm text-muted-foreground mt-2">
                מוצגות 10 השורות הראשונות מתוך {preview.rows}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
