import { Surah } from '@/lib/quran-api';

interface SurahCardProps {
  surah: Surah;
  onClick: () => void;
}

export function SurahCard({ surah, onClick }: SurahCardProps) {
  return (
    <button
      onClick={onClick}
      className="card-islamic w-full p-4 rounded-xl flex items-center gap-4 group"
    >
      {/* Surah Number - Islamic Star */}
      <div className="relative w-12 h-12 flex items-center justify-center flex-shrink-0">
        <svg 
          viewBox="0 0 48 48" 
          className="absolute inset-0 w-full h-full"
          fill="none"
        >
          <path 
            d="M24 0L28.5 14.5L43 10L33.5 20L48 24L33.5 28L43 38L28.5 33.5L24 48L19.5 33.5L5 38L14.5 28L0 24L14.5 20L5 10L19.5 14.5L24 0Z"
            className="fill-primary/10 stroke-primary/40"
            strokeWidth="1.5"
          />
        </svg>
        <span className="relative z-10 text-base font-semibold text-primary">
          {surah.number}
        </span>
      </div>
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Surah Info - Right side */}
      <div className="text-right min-w-0">
        <h3 className="font-arabic text-xl font-bold text-foreground truncate">
          {surah.name}
        </h3>
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>{surah.numberOfAyahs} ayat</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
          <span>{surah.englishName}</span>
        </div>
      </div>
    </button>
  );
}
