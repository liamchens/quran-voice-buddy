import { Surah } from '@/lib/quran-api';
import { ChevronLeft } from 'lucide-react';

interface SurahCardProps {
  surah: Surah;
  onClick: () => void;
}

export function SurahCard({ surah, onClick }: SurahCardProps) {
  return (
    <button
      onClick={onClick}
      className="card-islamic w-full p-4 rounded-xl flex items-center gap-4 text-right group"
    >
      {/* Surah Number - Circle */}
      <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center flex-shrink-0">
        <span className="text-lg font-semibold text-primary">
          {surah.number}
        </span>
      </div>
      
      {/* Surah Info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-arabic text-xl font-bold text-foreground truncate">
          {surah.name}
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{surah.englishName}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
          <span>{surah.numberOfAyahs} ayat</span>
        </div>
      </div>
      
      {/* Arrow */}
      <ChevronLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </button>
  );
}
