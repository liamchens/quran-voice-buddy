import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ValidationBadgeProps {
  isValid: boolean;
  matchPercentage: number;
}

export function ValidationBadge({ isValid, matchPercentage }: ValidationBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm slide-up',
        isValid
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive'
      )}
    >
      {isValid ? (
        <CheckCircle2 className="w-5 h-5" />
      ) : (
        <XCircle className="w-5 h-5" />
      )}
      <span>{isValid ? 'VALID' : 'TIDAK VALID'}</span>
      <span className="text-xs opacity-75">({Math.round(matchPercentage)}%)</span>
    </div>
  );
}
