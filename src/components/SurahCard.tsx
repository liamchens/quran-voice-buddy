import { MapPin, BookOpen } from 'lucide-react';
import { Surah } from '@/lib/quran-api';
import bintangImg from '@/assets/bintang.png';

interface SurahCardProps {
  surah: Surah;
  onClick: () => void;
}

export function SurahCard({ surah, onClick }: SurahCardProps) {
  const revelationPlace = surah.revelationType === 'Meccan' ? 'Mekah' : 'Madinah';
  
  // Remove "سورة" prefix from Arabic name
  const arabicName = surah.name.replace(/^سُورَةُ\s*/, '').replace(/^سورة\s*/, '');
  
  return (
    <button
      onClick={onClick}
      className="card-islamic w-full p-4 rounded-xl flex items-center gap-4 group"
    >
      {/* Surah Number - Islamic Star */}
      <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
        <img 
          src={bintangImg}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
        />
        <span className="relative z-10 text-sm font-semibold text-primary">
          {surah.number}
        </span>
      </div>
      
      {/* Surah Info - Middle */}
      <div className="flex-1 text-left min-w-0">
        <h3 className="text-base font-semibold text-foreground truncate">
          {surah.englishName}
        </h3>
        <p className="text-sm text-muted-foreground truncate">
          {surah.englishNameTranslation}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {revelationPlace}
          </span>
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {surah.numberOfAyahs}
          </span>
        </div>
      </div>
      
      {/* Arabic Name - Right */}
      <div className="text-right flex-shrink-0">
        <h3 className="font-arabic text-2xl font-bold text-primary">
          {arabicName}
        </h3>
      </div>
    </button>
  );
}