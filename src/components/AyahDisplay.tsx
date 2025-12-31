import { WordResult } from '@/lib/quran-api';
import { cn } from '@/lib/utils';

interface AyahDisplayProps {
  ayahText: string;
  wordResults?: WordResult[];
  ayahNumber: number;
}

export function AyahDisplay({ ayahText, wordResults, ayahNumber }: AyahDisplayProps) {
  // If we have word results, show highlighted version
  if (wordResults && wordResults.length > 0) {
    return (
      <div className="fade-in text-center p-6 rounded-2xl bg-card border border-border">
        <div className="flex items-center justify-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
            {ayahNumber}
          </span>
        </div>
        <p className="font-arabic text-2xl md:text-3xl leading-loose text-right" dir="rtl">
          {wordResults.map((result, index) => (
            <span
              key={index}
              className={cn(
                'mx-1 px-1 rounded transition-colors',
                result.isCorrect
                  ? 'text-success bg-success/10'
                  : 'text-destructive bg-destructive/10'
              )}
            >
              {result.expected || result.word}
            </span>
          ))}
        </p>
      </div>
    );
  }

  // Plain display without highlighting
  return (
    <div className="fade-in text-center p-6 rounded-2xl bg-card border border-border">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
          {ayahNumber}
        </span>
      </div>
      <p className="font-arabic text-2xl md:text-3xl leading-loose text-right" dir="rtl">
        {ayahText}
      </p>
    </div>
  );
}
