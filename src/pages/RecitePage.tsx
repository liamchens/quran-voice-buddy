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
  status: 'pending' | 'correct' | 'incorrect';
}

interface AyahStatus {
  ayahIndex: number;
  words: WordStatus[];
  isComplete: boolean;
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

  // Real-time matching across all ayahs
  const ayahStatuses = useMemo((): AyahStatus[] => {
    if (!surah) return [];
    
    const fullTranscript = (transcript + ' ' + interimTranscript).trim();
    const normalizedUser = normalizeArabic(fullTranscript);
    const userWords = normalizedUser.split(' ').filter(w => w.length > 0);
    
    const statuses: AyahStatus[] = surah.ayahs.map((ayah, ayahIdx) => {
      const ayahWords = ayah.text.split(' ').filter(w => w.length > 0);
      return {
        ayahIndex: ayahIdx,
        words: ayahWords.map(w => ({ word: w, status: 'pending' as const })),
        isComplete: false,
      };
    });
    
    // Match user words to reference words
    let userWordIndex = 0;
    for (let i = 0; i < allWordsFlat.length && userWordIndex < userWords.length; i++) {
      const refWord = allWordsFlat[i];
      const userWord = userWords[userWordIndex];
      
      const isCorrect = userWord === refWord.normalized;
      statuses[refWord.ayahIndex].words[refWord.wordIndex] = {
        word: refWord.word,
        status: isCorrect ? 'correct' : 'incorrect',
      };
      userWordIndex++;
    }
    
    // Mark ayahs as complete
    statuses.forEach(status => {
      const allSpoken = status.words.every(w => w.status !== 'pending');
      status.isComplete = allSpoken;
    });
    
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

  // Check if all ayahs are complete
  const allComplete = useMemo(() => {
    return ayahStatuses.length > 0 && ayahStatuses.every(s => s.isComplete);
  }, [ayahStatuses]);

  // Check how many words have been spoken
  const spokenWordsCount = useMemo(() => {
    return ayahStatuses.reduce((count, status) => {
      return count + status.words.filter(w => w.status !== 'pending').length;
    }, 0);
  }, [ayahStatuses]);

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

          {/* All Ayahs - Real-time display */}
          <div className="space-y-4" dir="rtl">
            {spokenWordsCount > 0 ? (
              // Show ayahs with real-time highlighting
              ayahStatuses.map((ayahStatus, ayahIdx) => {
                // Only show ayah if at least one word has been spoken
                const hasSpokenWords = ayahStatus.words.some(w => w.status !== 'pending');
                if (!hasSpokenWords) return null;
                
                return (
                  <p key={ayahIdx} className="font-arabic text-2xl md:text-3xl leading-[2.5] text-right">
                    {ayahStatus.words.map((wordStatus, wordIdx) => {
                      if (wordStatus.status === 'pending') return null;
                      return (
                        <span
                          key={wordIdx}
                          className={cn(
                            'mx-0.5 px-1 rounded transition-all duration-200',
                            wordStatus.status === 'correct' && 'text-success bg-success/15',
                            wordStatus.status === 'incorrect' && 'text-destructive bg-destructive/15 underline decoration-wavy'
                          )}
                        >
                          {wordStatus.word}
                        </span>
                      );
                    })}
                    {/* Ayah number marker - show only when ayah is complete */}
                    {ayahStatus.isComplete && (
                      <span className="inline-flex items-center justify-center min-w-[2rem] h-8 mx-2 px-2 text-sm rounded-full bg-primary/10 text-primary font-sans">
                        ۝{ayahIdx + 1}
                      </span>
                    )}
                  </p>
                );
              })
            ) : (
              // Empty state - waiting for user to speak
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
