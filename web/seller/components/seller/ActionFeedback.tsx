import React from 'react';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';

export interface ActionFeedbackState {
  type: 'success' | 'error' | 'validation' | 'manual-review' | null;
  message: string;
  detail?: string;
}

interface ActionFeedbackProps {
  feedback: ActionFeedbackState;
  onDismiss?: () => void;
  className?: string;
}

export function ActionFeedback({ feedback, onDismiss, className = '' }: ActionFeedbackProps) {
  if (!feedback.type || !feedback.message) {
    return null;
  }

  const isSuccess = feedback.type === 'success';
  const isReview = feedback.type === 'manual-review';

  return (
    <div
      role="alert"
      className={`rounded-md p-4 border text-sm flex items-start justify-between gap-3 ${
        isSuccess
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-300'
          : isReview
          ? 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-950/40 dark:border-purple-900 dark:text-purple-300'
          : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300'
      } ${className}`}
    >
      <div className="flex items-start gap-3">
        {isSuccess ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
        ) : isReview ? (
          <Clock className="h-5 w-5 shrink-0 text-purple-600 mt-0.5" />
        ) : (
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
        )}
        <div>
          <p className="font-semibold">{feedback.message}</p>
          {feedback.detail && <p className="text-xs opacity-90 mt-0.5">{feedback.detail}</p>}
        </div>
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-semibold opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
