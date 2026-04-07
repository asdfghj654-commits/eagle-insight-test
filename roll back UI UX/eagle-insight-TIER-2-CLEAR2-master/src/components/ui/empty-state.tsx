/**
 * Empty State Component
 * 
 * Provides consistent empty state display across the application.
 * Used when no data is available for a component.
 * 
 * PRODUCTION RULE: Always use this instead of showing demo/mock data.
 */

import React from 'react';
import { LucideIcon, Database, FileQuestion, AlertCircle, Info } from 'lucide-react';
import { Card, CardContent } from './card';
import { Button } from './button';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  /** Icon to display */
  icon?: LucideIcon;
  /** Main title text */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button/element */
  action?: React.ReactNode;
  /** Visual variant */
  variant?: 'default' | 'subtle' | 'warning' | 'info';
  /** Additional CSS classes */
  className?: string;
  /** Whether to show in a card wrapper */
  asCard?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Database,
  title,
  description,
  action,
  variant = 'default',
  className,
  asCard = false,
}) => {
  const variantStyles = {
    default: {
      iconClass: 'text-muted-foreground',
      titleClass: 'text-foreground',
      descClass: 'text-muted-foreground',
    },
    subtle: {
      iconClass: 'text-muted-foreground/50',
      titleClass: 'text-muted-foreground',
      descClass: 'text-muted-foreground/70',
    },
    warning: {
      iconClass: 'text-warning',
      titleClass: 'text-warning-foreground',
      descClass: 'text-muted-foreground',
    },
    info: {
      iconClass: 'text-primary',
      titleClass: 'text-foreground',
      descClass: 'text-muted-foreground',
    },
  };

  const styles = variantStyles[variant];

  const content = (
    <div 
      className={cn(
        'flex flex-col items-center justify-center py-12 text-center',
        className
      )}
      dir="rtl"
    >
      <Icon className={cn('h-12 w-12 mb-4 opacity-60', styles.iconClass)} />
      <h3 className={cn('text-lg font-medium mb-2', styles.titleClass)}>
        {title}
      </h3>
      {description && (
        <p className={cn('text-sm max-w-md mb-4', styles.descClass)}>
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );

  if (asCard) {
    return (
      <Card>
        <CardContent className="p-0">
          {content}
        </CardContent>
      </Card>
    );
  }

  return content;
};

/**
 * Specialized empty states for common scenarios
 */

export const NoDataEmptyState: React.FC<{
  message?: string;
  onUploadClick?: () => void;
}> = ({ 
  message = 'אין נתונים זמינים', 
  onUploadClick 
}) => (
  <EmptyState
    icon={Database}
    title={message}
    description="העלה קובץ CSV עם נתוני טיסה להתחלת ניתוח"
    action={onUploadClick && (
      <Button onClick={onUploadClick}>
        העלה CSV
      </Button>
    )}
  />
);

export const NoFindingsEmptyState: React.FC<{
  hasData?: boolean;
}> = ({ hasData = false }) => (
  <EmptyState
    icon={AlertCircle}
    title="אין ממצאים פעילים"
    description={
      hasData 
        ? "הנתונים נותחו ולא נמצאו חריגות הדורשות תשומת לב"
        : "העלה נתוני טיסה לביצוע ניתוח ואיתור ממצאים"
    }
    variant={hasData ? 'info' : 'default'}
  />
);

export const NoFlightsEmptyState: React.FC = () => (
  <EmptyState
    icon={FileQuestion}
    title="אין טיסות זמינות"
    description="לא נמצאו טיסות בנתונים. ודא שקובץ ה-CSV מכיל את העמודות הנדרשות."
  />
);

export const NoAircraftEmptyState: React.FC = () => (
  <EmptyState
    icon={FileQuestion}
    title="אין מטוסים זמינים"
    description="לא נמצאו מטוסים בנתונים. העלה קובץ CSV עם עמודת tail_number."
  />
);

export const NoHistoryEmptyState: React.FC = () => (
  <EmptyState
    icon={Info}
    title="אין נתוני היסטוריה"
    description="נדרשים נתוני טיסה וממצאים לחישוב סטטיסטיקות היסטוריות"
    variant="subtle"
  />
);

export const ParameterUnavailableEmptyState: React.FC<{
  parameterName: string;
}> = ({ parameterName }) => (
  <EmptyState
    icon={AlertCircle}
    title={`אין נתונים לפרמטר: ${parameterName}`}
    description="הפרמטר לא קיים בקובץ ה-CSV או שאין לו ערכים תקינים"
    variant="warning"
  />
);

export default EmptyState;
