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
  status: 'pending' | 'correct' | 'incorrect' | 'skipped';
  errorReason?: string;
}

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

  // Build all words from all ayahs
  const allWordsFlat = useMemo(() => {
    if (!surah) return [];
    const words: { word: string; normalized: string; ayahIndex: number; wordIndex: number }[] = [];
    
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
        });
      });
    });
    
    return words;
  }, [surah]);

  // Real-time matching - sequential with skip detection
  const wordStatuses = useMemo((): WordStatus[] => {
    if (!surah || allWordsFlat.length === 0) return [];
    
    const fullTranscript = (transcript + ' ' + interimTranscript).trim();
    const normalizedUser = normalizeArabic(fullTranscript);
    const userWords = normalizedUser.split(' ').filter(w => w.length > 0);
    
    // Initialize all words as pending
    const statuses: WordStatus[] = allWordsFlat.map(w => ({
      word: w.word,
      status: 'pending' as const,
    }));
    
    if (userWords.length === 0) return statuses;
    
    let refIndex = 0;
    let userIndex = 0;
    
    while (userIndex < userWords.length && refIndex < allWordsFlat.length) {
      const userWord = userWords[userIndex];
      const refWord = allWordsFlat[refIndex];
      
      // Exact match - correct
      if (userWord === refWord.normalized) {
        statuses[refIndex] = { word: refWord.word, status: 'correct' };
        refIndex++;
        userIndex++;
        continue;
      }
      
      // Look ahead to detect skipped words (user jumped ahead)
      let foundAhead = -1;
      for (let lookAhead = refIndex + 1; lookAhead < Math.min(refIndex + 10, allWordsFlat.length); lookAhead++) {
        if (userWord === allWordsFlat[lookAhead].normalized) {
          foundAhead = lookAhead;
          break;
        }
      }
      
      if (foundAhead !== -1) {
        // Mark all skipped words as skipped
        for (let skip = refIndex; skip < foundAhead; skip++) {
          statuses[skip] = {
            word: allWordsFlat[skip].word,
            status: 'skipped',
            errorReason: 'Ayat terlewat',
          };
        }
        // Mark found word as correct
        statuses[foundAhead] = { word: allWordsFlat[foundAhead].word, status: 'correct' };
        refIndex = foundAhead + 1;
        userIndex++;
      } else {
        // No match found - incorrect pronunciation
        statuses[refIndex] = {
          word: refWord.word,
          status: 'incorrect',
          errorReason: 'Pengucapan salah',
        };
        refIndex++;
        userIndex++;
      }
    }
    
    return statuses;
  }, [surah, transcript, interimTranscript, allWordsFlat]);

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

  // Check how many words have been spoken
  const spokenWordsCount = useMemo(() => {
    return wordStatuses.filter(w => w.status !== 'pending').length;
  }, [wordStatuses]);

  // Check if all words are complete
  const allComplete = useMemo(() => {
    return wordStatuses.length > 0 && wordStatuses.every(s => s.status !== 'pending');
  }, [wordStatuses]);

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
        <Header showBack />
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
        <Header title={surah.name} subtitle={surah.englishName} showBack />
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
      <Header title={surah.name} subtitle={surah.englishName} showBack />

      <main className="container py-6 pb-40">
        {/* Ayah Display - Tarteel Style */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6 fade-in">
          {/* Surah Title */}
          <div className="text-center mb-6 pb-4 border-b border-border">
            <p className="font-arabic text-xl text-primary">{surah.name}</p>
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
              <p className="font-arabic text-2xl md:text-3xl leading-[2.5] text-right">
                {wordStatuses.map((wordStatus, idx) => {
                  if (wordStatus.status === 'pending') return null;
                  
                  const isError = wordStatus.status === 'incorrect' || wordStatus.status === 'skipped';
                  
                  return (
                    <span key={idx} className="relative group inline">
                      <span
                        className={cn(
                          'px-1 rounded-md transition-all duration-200',
                          wordStatus.status === 'correct' && 'text-success bg-success/10',
                          wordStatus.status === 'incorrect' && 'text-destructive bg-destructive/10',
                          wordStatus.status === 'skipped' && 'text-amber-600 bg-amber-500/10'
                        )}
                      >
                        {wordStatus.word}
                      </span>
                      {/* Error tooltip */}
                      {isError && wordStatus.errorReason && (
                        <span className="absolute -top-8 right-0 z-10 hidden group-hover:block bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded whitespace-nowrap font-sans">
                          {wordStatus.errorReason}
                        </span>
                      )}
                      <span className="inline"> </span>
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
        {spokenWordsCount > 0 && (
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

        {/* Completion Message */}
        {allComplete && (
          <div className="text-center p-8 rounded-2xl bg-success/10 border border-success/20 slide-up">
            <p className="text-2xl mb-2">🎉</p>
            <h3 className="text-xl font-bold text-success mb-2">
              MasyaAllah, Selesai!
            </h3>
            <p className="text-muted-foreground">
              Anda telah menyelesaikan hafalan Surah {surah.englishName}
            </p>
          </div>
        )}
      </main>

      {/* Fixed Bottom Voice Control */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border py-4">
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
