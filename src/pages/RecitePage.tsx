import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { Header } from '@/components/Header';
import { VoiceIndicator } from '@/components/VoiceIndicator';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  fetchSurahDetail,
  SurahDetail,
  normalizeArabic,
} from '@/lib/quran-api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WordStatus {
  word: string;
  status: 'pending' | 'correct' | 'skipped';
  errorReason?: string;
}

// Random appreciation messages based on performance
const ENCOURAGING_MESSAGES = [
  { title: 'Tetap Semangat!', emoji: '💪' },
  { title: 'Jangan Menyerah!', emoji: '🌱' },
  { title: 'Terus Berlatih!', emoji: '📖' },
  { title: 'Perbaiki Lagi Ya!', emoji: '🔄' },
];

const GOOD_MESSAGES = [
  { title: 'Alhamdulillah, Bagus!', emoji: '👏' },
  { title: 'Barakallahu Fiik!', emoji: '🌟' },
  { title: 'Teruskan!', emoji: '✨' },
  { title: 'Semangat Terus!', emoji: '🔥' },
];

const PERFECT_MESSAGES = [
  { title: 'MasyaAllah, Luar Biasa!', emoji: '🎉' },
  { title: 'Alhamdulillah, Sempurna!', emoji: '🏆' },
  { title: 'MasyaAllah Tabarakallah!', emoji: '🌙' },
  { title: 'Hebat Sekali!', emoji: '💎' },
  { title: 'Hafalan Mantap!', emoji: '⭐' },
];

const getRandomAppreciation = (isComplete: boolean, hasSkipped: boolean) => {
  let list;
  if (hasSkipped) {
    // Ada ayat terlewat - kasih pesan encouraging
    list = ENCOURAGING_MESSAGES;
  } else if (isComplete) {
    // Selesai tanpa ada yang terlewat - kasih pujian kagum
    list = PERFECT_MESSAGES;
  } else {
    // Belum selesai tapi tidak ada yang terlewat - kasih pujian bagus
    list = GOOD_MESSAGES;
  }
  return list[Math.floor(Math.random() * list.length)];
};

const RecitePage = () => {
  const { surahNumber } = useParams<{ surahNumber: string }>();
  const [surah, setSurah] = useState<SurahDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
    error: speechError,
  } = useSpeechRecognition();

  // Build all words from all ayahs with ayah end markers
  const allWordsFlat = useMemo(() => {
    if (!surah) return [];
    const words: { word: string; normalized: string; ayahIndex: number; wordIndex: number; isLastWord: boolean }[] = [];
    
    surah.ayahs.forEach((ayah, ayahIdx) => {
      const ayahWords = ayah.text.split(' ').filter(w => w.length > 0);
      const normalizedAyah = normalizeArabic(ayah.text);
      const normalizedWords = normalizedAyah.split(' ').filter(w => w.length > 0);
      
      ayahWords.forEach((word, wordIdx) => {
        words.push({
          word,
          normalized: normalizedWords[wordIdx] || '',
          ayahIndex: ayahIdx,
          wordIndex: wordIdx,
          isLastWord: wordIdx === ayahWords.length - 1,
        });
      });
    });
    
    return words;
  }, [surah]);

  // Real-time matching - only mark skipped ayahs as error
  const wordStatuses = useMemo(() => {
    if (!surah || allWordsFlat.length === 0) return [];
    
    const fullTranscript = (transcript + ' ' + interimTranscript).trim();
    const normalizedUser = normalizeArabic(fullTranscript);
    const userWords = normalizedUser.split(' ').filter(w => w.length > 0);
    
    type ExtendedWordStatus = WordStatus & { isLastWord: boolean; ayahNumber: number };
    
    // Initialize all words as pending
    const statuses: ExtendedWordStatus[] = allWordsFlat.map(w => ({
      word: w.word,
      status: 'pending' as const,
      isLastWord: w.isLastWord,
      ayahNumber: w.ayahIndex + 1,
    }));
    
    if (userWords.length === 0) return statuses;
    
    let refIndex = 0;
    let userIndex = 0;
    
    while (userIndex < userWords.length && refIndex < allWordsFlat.length) {
      const userWord = userWords[userIndex];
      const refWord = allWordsFlat[refIndex];
      
      // Exact match - correct
      if (userWord === refWord.normalized) {
        statuses[refIndex] = { 
          word: refWord.word, 
          status: 'correct',
          isLastWord: refWord.isLastWord,
          ayahNumber: refWord.ayahIndex + 1,
        };
        refIndex++;
        userIndex++;
        continue;
      }
      
      // Look ahead to detect skipped words (user jumped ahead) - search entire remaining surah
      let foundAhead = -1;
      for (let lookAhead = refIndex + 1; lookAhead < allWordsFlat.length; lookAhead++) {
        if (userWord === allWordsFlat[lookAhead].normalized) {
          foundAhead = lookAhead;
          break;
        }
      }
      
      if (foundAhead !== -1) {
        // Mark all skipped words as skipped (ayat terlewat)
        for (let skip = refIndex; skip < foundAhead; skip++) {
          statuses[skip] = {
            word: allWordsFlat[skip].word,
            status: 'skipped',
            errorReason: 'Ayat terlewat',
            isLastWord: allWordsFlat[skip].isLastWord,
            ayahNumber: allWordsFlat[skip].ayahIndex + 1,
          };
        }
        // Mark found word as correct
        statuses[foundAhead] = { 
          word: allWordsFlat[foundAhead].word, 
          status: 'correct',
          isLastWord: allWordsFlat[foundAhead].isLastWord,
          ayahNumber: allWordsFlat[foundAhead].ayahIndex + 1,
        };
        refIndex = foundAhead + 1;
        userIndex++;
      } else {
        // No exact match found anywhere - tolerance for pronunciation variations
        // Mark current reference word as correct and move on
        statuses[refIndex] = {
          word: refWord.word,
          status: 'correct',
          isLastWord: refWord.isLastWord,
          ayahNumber: refWord.ayahIndex + 1,
        };
        refIndex++;
        userIndex++;
      }
    }
    
    return statuses;
  }, [surah, transcript, interimTranscript, allWordsFlat]);

  // Check how many words have been spoken
  const spokenWordsCount = useMemo(() => {
    return wordStatuses.filter(w => w.status !== 'pending').length;
  }, [wordStatuses]);

  // Check if all words are complete
  const allComplete = useMemo(() => {
    return wordStatuses.length > 0 && wordStatuses.every(s => s.status !== 'pending');
  }, [wordStatuses]);

  // Auto-stop when complete
  useEffect(() => {
    if (allComplete && isListening) {
      stopListening();
    }
  }, [allComplete, isListening, stopListening]);

  // Load surah data
  useEffect(() => {
    async function loadSurah() {
      if (!surahNumber) return;

      try {
        setIsLoading(true);
        const data = await fetchSurahDetail(parseInt(surahNumber));
        setSurah(data);
      } catch (err) {
        setError('Gagal memuat surah. Silakan coba lagi.');
      } finally {
        setIsLoading(false);
      }
    }
    loadSurah();
  }, [surahNumber]);

  // Handle voice toggle
  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  // Retry - reset transcript
  const handleRetry = useCallback(() => {
    resetTranscript();
  }, [resetTranscript]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background islamic-pattern">
        <Header showBack />
        <div className="flex flex-col items-center justify-center py-32">
          <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="mt-4 text-muted-foreground">Memuat surah...</p>
        </div>
      </div>
    );
  }

  if (error || !surah) {
    return (
      <div className="min-h-screen bg-background islamic-pattern">
        <Header showBack minimalMode />
        <div className="flex flex-col items-center justify-center py-32">
          <p className="text-destructive mb-4">{error || 'Surah tidak ditemukan'}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-islamic px-6 py-3 rounded-xl"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-background islamic-pattern">
        <Header title={surah.name} subtitle={surah.englishName} showBack minimalMode />
        <div className="container py-12">
          <div className="text-center p-8 rounded-2xl bg-destructive/10 border border-destructive/20">
            <p className="text-destructive font-semibold mb-2">
              Browser Tidak Didukung
            </p>
            <p className="text-muted-foreground text-sm">
              Speech Recognition tidak tersedia di browser ini. Silakan gunakan Chrome atau Edge.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header title={surah.name} subtitle={surah.englishName} showBack minimalMode />

      <main className="container py-6 pb-48 md:pb-40">
        {/* Ayah Display - Tarteel Style */}
        <div className="bg-card rounded-2xl border border-border p-4 md:p-6 mb-6 fade-in">
          {/* Surah Title */}
          <div className="text-center mb-6 pb-4 border-b border-border">
            <p className="font-arabic text-2xl md:text-3xl text-primary">{surah.name}</p>
          </div>

          {/* Bismillah (except Al-Fatihah and At-Taubah) */}
          {parseInt(surahNumber || '1') !== 1 && parseInt(surahNumber || '1') !== 9 && (
            <p className="font-arabic text-xl text-center text-muted-foreground mb-6" dir="rtl">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
          )}

          {/* All Words - Horizontal Mushaf Style */}
          <div dir="rtl">
            {spokenWordsCount > 0 ? (
              <p className="font-arabic text-2xl md:text-3xl leading-[2.8] text-right">
                {wordStatuses.map((wordStatus, idx) => {
                  if (wordStatus.status === 'pending') return null;
                  
                  const isSkipped = wordStatus.status === 'skipped';
                  
                  return (
                    <span key={idx} className="relative group inline">
                      <span
                        className={cn(
                          'px-0.5 rounded transition-all duration-200',
                          wordStatus.status === 'correct' && 'text-success',
                          isSkipped && 'text-amber-500'
                        )}
                      >
                        {wordStatus.word}
                      </span>
                      {/* Error tooltip for skipped */}
                      {isSkipped && wordStatus.errorReason && (
                        <span className="absolute -top-8 right-0 z-10 hidden group-hover:block bg-amber-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap font-sans">
                          {wordStatus.errorReason}
                        </span>
                      )}
                      {/* Ayah end marker */}
                      {wordStatus.isLastWord && (
                        <span className="inline-flex items-center justify-center w-6 h-6 mx-1 text-xs rounded-full border border-primary/30 text-primary font-sans">
                          {wordStatus.ayahNumber}
                        </span>
                      )}
                      {!wordStatus.isLastWord && <span className="inline"> </span>}
                    </span>
                  );
                })}
              </p>
            ) : (
              // Empty state
              <div className="text-center py-8">
                <p className="text-muted-foreground text-lg mb-2">
                  Surah {surah.englishName} ({surah.numberOfAyahs} Ayat)
                </p>
                <p className="text-muted-foreground/60 text-sm">
                  Silakan mulai membaca, ayat akan muncul secara real-time...
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Retry button */}
        {spokenWordsCount > 0 && !allComplete && (
          <div className="flex justify-center mb-6">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Ulangi dari Awal
            </Button>
          </div>
        )}

        {/* Speech Error */}
        {speechError && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-6 fade-in">
            <p className="text-sm text-destructive text-center">{speechError}</p>
          </div>
        )}

        {/* Completion/Appreciation Message */}
        {!isListening && spokenWordsCount > 0 && (() => {
          const hasSkipped = wordStatuses.some(w => w.status === 'skipped');
          const appreciation = getRandomAppreciation(allComplete, hasSkipped);
          const progressPercent = Math.round((spokenWordsCount / wordStatuses.length) * 100);
          const skippedCount = wordStatuses.filter(w => w.status === 'skipped').length;
          
          return (
            <div className={cn(
              "text-center p-6 md:p-8 rounded-2xl slide-up",
              hasSkipped 
                ? "bg-amber-500/10 border border-amber-500/20" 
                : "bg-success/10 border border-success/20"
            )}>
              <p className="text-3xl mb-2">{appreciation.emoji}</p>
              <h3 className={cn(
                "text-lg md:text-xl font-bold mb-2",
                hasSkipped ? "text-amber-600" : "text-success"
              )}>
                {appreciation.title}
              </h3>
              <p className="text-muted-foreground text-sm md:text-base">
                {allComplete && !hasSkipped
                  ? `Anda telah menyelesaikan hafalan Surah ${surah.englishName} dengan sempurna. Semoga berkah!` 
                  : hasSkipped 
                    ? `Ada ${skippedCount} kata yang terlewat. Progres: ${progressPercent}%. Coba lagi ya!`
                    : `Progres: ${progressPercent}% (${spokenWordsCount} dari ${wordStatuses.length} kata). Lanjutkan lagi kapan saja!`}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="gap-2 mt-4"
              >
                <RefreshCw className="w-4 h-4" />
                Ulangi dari Awal
              </Button>
            </div>
          );
        })()}
      </main>

      {/* Fixed Bottom Voice Control - Responsive */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border py-3 md:py-4">
        <div className="container flex flex-col items-center gap-2">
          <VoiceIndicator isListening={isListening} onClick={handleVoiceToggle} />
          <p className="text-xs text-muted-foreground">
            {isListening ? '🎙️ Mendengarkan...' : 'Tekan untuk mulai membaca'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RecitePage;
