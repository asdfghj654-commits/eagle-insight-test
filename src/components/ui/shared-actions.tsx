/**
 * Shared Action Components
 * 
 * Components אחידים לכל פעולות המערכת:
 * - ConfirmModal: לפעולות הרסניות/חשובות
 * - ActionButton: כפתור עם states (loading/disabled/tooltip)
 * - EmptyState: מצב ריק אחיד
 * - useActionToast: hook להודעות הצלחה/שגיאה
 * 
 * כלל מנחה: "אין כפתורים מתים" - כל כפתור חייב להיות:
 * 1. עובד (onClick עושה משהו ברור)
 * 2. Disabled + Tooltip "למה לא זמין"
 * 3. In progress (Spinner + "מבצע...")
 * 4. מוסתר (אם אין פעולה מינימלית)
 */

import React, { useState, ReactNode } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button, ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Info, FileQuestion } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// =============================================================================
// CONFIRM MODAL - לפעולות הרסניות/חשובות
// =============================================================================

export interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleHe?: string;
  description: string;
  descriptionHe?: string;
  confirmLabel?: string;
  confirmLabelHe?: string;
  cancelLabel?: string;
  cancelLabelHe?: string;
  variant?: 'default' | 'destructive' | 'warning';
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  onOpenChange,
  title,
  titleHe,
  description,
  descriptionHe,
  confirmLabel = 'Confirm',
  confirmLabelHe = 'אישור',
  cancelLabel = 'Cancel',
  cancelLabelHe = 'ביטול',
  variant = 'default',
  onConfirm,
  isLoading = false,
}) => {
  const [localLoading, setLocalLoading] = useState(false);
  const loading = isLoading || localLoading;

  const handleConfirm = async () => {
    setLocalLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setLocalLoading(false);
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'destructive':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      default:
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl" className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {getIcon()}
            {titleHe || title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {descriptionHe || description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={loading}>
            {cancelLabelHe || cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={loading}
            variant={variant === 'warning' ? 'warning' : variant}
          >
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                מבצע...
              </>
            ) : (
              confirmLabelHe || confirmLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// =============================================================================
// ACTION BUTTON - כפתור עם כל ה-states
// =============================================================================

export interface ActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  onClick?: () => void | Promise<void>;
  isLoading?: boolean;
  loadingText?: string;
  disabledReason?: string;
  disabledReasonHe?: string;
  showTooltip?: boolean;
  confirmBefore?: {
    title: string;
    titleHe?: string;
    description: string;
    descriptionHe?: string;
    variant?: 'default' | 'destructive' | 'warning';
  };
}

export const ActionButton: React.FC<ActionButtonProps> = ({
  children,
  onClick,
  isLoading: externalLoading,
  loadingText = 'מבצע...',
  disabled,
  disabledReason,
  disabledReasonHe,
  showTooltip = true,
  confirmBefore,
  ...props
}) => {
  const [internalLoading, setInternalLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  const isLoading = externalLoading || internalLoading;
  const isDisabled = disabled || isLoading;
  const tooltipText = disabledReasonHe || disabledReason;

  const handleClick = async () => {
    if (confirmBefore) {
      setConfirmOpen(true);
      return;
    }

    if (onClick) {
      setInternalLoading(true);
      try {
        await onClick();
      } finally {
        setInternalLoading(false);
      }
    }
  };

  const handleConfirm = async () => {
    if (onClick) {
      setInternalLoading(true);
      try {
        await onClick();
      } finally {
        setInternalLoading(false);
      }
    }
  };

  const button = (
    <Button
      {...props}
      disabled={isDisabled}
      onClick={handleClick}
    >
      {isLoading ? (
        <>
          <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );

  return (
    <>
      {showTooltip && tooltipText && isDisabled && !isLoading ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">{button}</span>
          </TooltipTrigger>
          <TooltipContent dir="rtl">
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        button
      )}

      {confirmBefore && (
        <ConfirmModal
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={confirmBefore.title}
          titleHe={confirmBefore.titleHe}
          description={confirmBefore.description}
          descriptionHe={confirmBefore.descriptionHe}
          variant={confirmBefore.variant}
          onConfirm={handleConfirm}
          isLoading={isLoading}
        />
      )}
    </>
  );
};

// =============================================================================
// EMPTY STATE - מצב ריק אחיד
// =============================================================================

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  titleHe?: string;
  description?: string;
  descriptionHe?: string;
  action?: {
    label: string;
    labelHe?: string;
    onClick: () => void;
  };
  variant?: 'default' | 'no-data' | 'no-permission' | 'error';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  titleHe,
  description,
  descriptionHe,
  action,
  variant = 'default',
}) => {
  const getDefaultIcon = () => {
    switch (variant) {
      case 'no-data':
        return <FileQuestion className="h-12 w-12 text-muted-foreground/50" />;
      case 'no-permission':
        return <XCircle className="h-12 w-12 text-red-400" />;
      case 'error':
        return <AlertTriangle className="h-12 w-12 text-orange-400" />;
      default:
        return <Info className="h-12 w-12 text-muted-foreground/50" />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center" dir="rtl">
      <div className="mb-4">
        {icon || getDefaultIcon()}
      </div>
      <h3 className="text-lg font-semibold mb-2">
        {titleHe || title}
      </h3>
      {(descriptionHe || description) && (
        <p className="text-muted-foreground max-w-md mb-4">
          {descriptionHe || description}
        </p>
      )}
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.labelHe || action.label}
        </Button>
      )}
    </div>
  );
};

// =============================================================================
// USE ACTION TOAST - hook להודעות
// =============================================================================

export interface ActionToastOptions {
  successTitle?: string;
  successTitleHe?: string;
  successDescription?: string;
  successDescriptionHe?: string;
  errorTitle?: string;
  errorTitleHe?: string;
  errorDescription?: string;
  errorDescriptionHe?: string;
}

export const useActionToast = () => {
  const { toast } = useToast();

  const showSuccess = (titleHe: string, descriptionHe?: string) => {
    toast({
      title: titleHe,
      description: descriptionHe,
      variant: 'success',
    });
  };

  const showError = (titleHe: string, descriptionHe?: string) => {
    toast({
      title: titleHe,
      description: descriptionHe,
      variant: 'destructive',
    });
  };

  const showInfo = (titleHe: string, descriptionHe?: string) => {
    toast({
      title: titleHe,
      description: descriptionHe,
      variant: 'info',
    });
  };

  const showWarning = (titleHe: string, descriptionHe?: string) => {
    toast({
      title: titleHe,
      description: descriptionHe,
      variant: 'warning',
    });
  };

  /**
   * Wrap an async action with automatic success/error toasts
   */
  const withToast = async <T,>(
    action: () => Promise<T>,
    options: ActionToastOptions
  ): Promise<T | null> => {
    try {
      const result = await action();
      showSuccess(
        options.successTitleHe || options.successTitle || 'הפעולה הצליחה',
        options.successDescriptionHe || options.successDescription
      );
      return result;
    } catch (error) {
      showError(
        options.errorTitleHe || options.errorTitle || 'שגיאה',
        options.errorDescriptionHe || options.errorDescription || 'הפעולה נכשלה'
      );
      return null;
    }
  };

  return {
    showSuccess,
    showError,
    showInfo,
    showWarning,
    withToast,
  };
};

// =============================================================================
// STATUS BADGE - תצוגת סטטוס אחידה
// =============================================================================

export type StatusType = 
  | 'new' | 'open' | 'acknowledged' | 'in_progress' 
  | 'pending' | 'resolved' | 'closed' | 'rejected'
  | 'draft' | 'pending_approval' | 'active' | 'paused' | 'deprecated';

const STATUS_CONFIG: Record<StatusType, { label: string; labelHe: string; color: string }> = {
  new: { label: 'New', labelHe: 'חדש', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  open: { label: 'Open', labelHe: 'פתוח', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  acknowledged: { label: 'Acknowledged', labelHe: 'הוכר', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  in_progress: { label: 'In Progress', labelHe: 'בטיפול', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  pending: { label: 'Pending', labelHe: 'ממתין', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  pending_approval: { label: 'Pending Approval', labelHe: 'ממתין לאישור', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
  resolved: { label: 'Resolved', labelHe: 'נפתר', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  closed: { label: 'Closed', labelHe: 'נסגר', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200' },
  rejected: { label: 'Rejected', labelHe: 'נדחה', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  draft: { label: 'Draft', labelHe: 'טיוטה', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  active: { label: 'Active', labelHe: 'פעיל', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  paused: { label: 'Paused', labelHe: 'מושהה', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  deprecated: { label: 'Deprecated', labelHe: 'לא בשימוש', color: 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
};

export interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const config = STATUS_CONFIG[status as StatusType] || {
    label: status,
    labelHe: status,
    color: 'bg-gray-100 text-gray-800',
  };

  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClasses}`}>
      {config.labelHe}
    </span>
  );
};

// =============================================================================
// EXPORTS
// =============================================================================

export { STATUS_CONFIG };
