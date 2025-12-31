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
        <img 
          src="https://2zojb93ygj.ucarcdn.net/bdb1428f-4e8d-4bed-b031-5f99d5f3f8a2/bintang.png"
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
        />
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
