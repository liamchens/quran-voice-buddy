import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  normalized: string;
  status: 'pending' | 'correct' | 'incorrect';
  ayahIndex: number;
  isLastWord: boolean;
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

const getRandomAppreciation = (isComplete: boolean, hasIncorrect: boolean) => {
  let list;
  if (hasIncorrect) {
    list = ENCOURAGING_MESSAGES;
  } else if (isComplete) {
    list = PERFECT_MESSAGES;
  } else {
    list = GOOD_MESSAGES;
  }
  return list[Math.floor(Math.random() * list.length)];
};

// Levenshtein distance for better Arabic matching
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  if (m === 0) return n;
  if (n === 0) return m;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

// Calculate similarity using Levenshtein
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return ((maxLength - distance) / maxLength) * 100;
}

const RecitePage = () => {
  const { surahNumber } = useParams<{ surahNumber: string }>();
  const [surah, setSurah] = useState<SurahDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Word statuses - managed as state for Tarteel-style incremental matching
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const lastProcessedWordsRef = useRef<string>('');

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

  // Initialize word statuses when surah loads
  useEffect(() => {
    if (!surah) return;
    
    const statuses: WordStatus[] = [];
    surah.ayahs.forEach((ayah, ayahIdx) => {
      const ayahWords = ayah.text.split(' ').filter(w => w.length > 0);
      const normalizedAyah = normalizeArabic(ayah.text);
      const normalizedWords = normalizedAyah.split(' ').filter(w => w.length > 0);
      
      ayahWords.forEach((word, wordIdx) => {
        statuses.push({
          word,
          normalized: normalizedWords[wordIdx] || '',
          status: 'pending',
          ayahIndex: ayahIdx,
          isLastWord: wordIdx === ayahWords.length - 1,
        });
      });
    });
    
    setWordStatuses(statuses);
    setCurrentWordIndex(0);
    lastProcessedWordsRef.current = '';
  }, [surah]);

  // Tarteel-style incremental matching - process one word at a time
  useEffect(() => {
    if (!isListening || wordStatuses.length === 0) return;
    if (currentWordIndex >= wordStatuses.length) return;
    
    // Combine transcript for matching
    const fullTranscript = transcript.trim();
    const normalizedFull = normalizeArabic(fullTranscript);
    const userWords = normalizedFull.split(' ').filter(w => w.length > 0);
    
    // Only process NEW words that haven't been processed yet
    const lastProcessedCount = lastProcessedWordsRef.current.split(' ').filter(w => w.length > 0).length;
    
    if (userWords.length <= lastProcessedCount) return;
    
    // Get only the new words
    const newWords = userWords.slice(lastProcessedCount);
    
    // Process each new word one by one
    let newCurrentIndex = currentWordIndex;
    const updatedStatuses = [...wordStatuses];
    
    for (const userWord of newWords) {
      if (newCurrentIndex >= wordStatuses.length) break;
      
      const currentRef = wordStatuses[newCurrentIndex];
      const similarity = calculateSimilarity(userWord, currentRef.normalized);
      
      // STRICT matching: 60% similarity threshold for pronunciation tolerance
      const SIMILARITY_THRESHOLD = 60;
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        // Word matches - mark as correct
        updatedStatuses[newCurrentIndex] = {
          ...currentRef,
          status: 'correct',
        };
        newCurrentIndex++;
      } else {
        // Check if user skipped ahead (look ahead max 5 words) - ONLY within the same ayah
        const currentAyah = currentRef.ayahIndex;
        let foundAhead = -1;

        for (let i = newCurrentIndex + 1; i < Math.min(newCurrentIndex + 6, wordStatuses.length); i++) {
          const sameAyah = wordStatuses[i].ayahIndex === currentAyah;
          const isNextAyahFirstWord =
            currentRef.isLastWord &&
            i === newCurrentIndex + 1 &&
            wordStatuses[i].ayahIndex === currentAyah + 1;

          // Stop searching when ayah changes (prevents jumping across verses),
          // except allow moving to the FIRST word of the next ayah when we're at the last word.
          if (!sameAyah && !isNextAyahFirstWord) break;

          const aheadSimilarity = calculateSimilarity(userWord, wordStatuses[i].normalized);
          if (aheadSimilarity >= SIMILARITY_THRESHOLD) {
            foundAhead = i;
            break;
          }
        }

        if (foundAhead !== -1) {
          // User skipped some words - mark skipped as incorrect (within the same ayah)
          for (let i = newCurrentIndex; i < foundAhead; i++) {
            if (wordStatuses[i].ayahIndex !== currentAyah) break;
            updatedStatuses[i] = {
              ...wordStatuses[i],
              status: 'incorrect',
            };
          }
          // Mark the found word as correct
          updatedStatuses[foundAhead] = {
            ...wordStatuses[foundAhead],
            status: 'correct',
          };
          newCurrentIndex = foundAhead + 1;
        }
        // If no match found anywhere, ignore this word (noise/misrecognition)
      }
    }
    
    // Update state
    if (newCurrentIndex !== currentWordIndex) {
      setWordStatuses(updatedStatuses);
      setCurrentWordIndex(newCurrentIndex);
    }
    lastProcessedWordsRef.current = fullTranscript;
    
  }, [transcript, isListening, wordStatuses, currentWordIndex]);

  // Check how many words have been spoken
  const spokenWordsCount = useMemo(() => {
    return wordStatuses.filter(w => w.status !== 'pending').length;
  }, [wordStatuses]);

  // Check if all words are complete (only when we reached the final word)
  const allComplete = useMemo(() => {
    return wordStatuses.length > 0 && currentWordIndex >= wordStatuses.length;
  }, [wordStatuses.length, currentWordIndex]);

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

  // Reset all word statuses to pending
  const resetWordStatuses = useCallback(() => {
    if (!surah) return;
    
    const statuses: WordStatus[] = [];
    surah.ayahs.forEach((ayah, ayahIdx) => {
      const ayahWords = ayah.text.split(' ').filter(w => w.length > 0);
      const normalizedAyah = normalizeArabic(ayah.text);
      const normalizedWords = normalizedAyah.split(' ').filter(w => w.length > 0);
      
      ayahWords.forEach((word, wordIdx) => {
        statuses.push({
          word,
          normalized: normalizedWords[wordIdx] || '',
          status: 'pending',
          ayahIndex: ayahIdx,
          isLastWord: wordIdx === ayahWords.length - 1,
        });
      });
    });
    
    setWordStatuses(statuses);
    setCurrentWordIndex(0);
    lastProcessedWordsRef.current = '';
  }, [surah]);

  // Handle voice toggle
  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      resetTranscript();
      resetWordStatuses();
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript, resetWordStatuses]);

  // Retry - reset transcript and word statuses
  const handleRetry = useCallback(() => {
    resetTranscript();
    resetWordStatuses();
  }, [resetTranscript, resetWordStatuses]);

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
                  
                  const isIncorrect = wordStatus.status === 'incorrect';
                  
                  return (
                    <span key={idx} className="relative group inline">
                      <span
                        className={cn(
                          'px-0.5 rounded transition-all duration-200',
                          wordStatus.status === 'correct' && 'text-success',
                          isIncorrect && 'text-amber-500'
                        )}
                      >
                        {wordStatus.word}
                      </span>
                      {/* Error tooltip for incorrect/skipped */}
                      {isIncorrect && (
                        <span className="absolute -top-8 right-0 z-10 hidden group-hover:block bg-amber-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap font-sans">
                          Ayat terlewat
                        </span>
                      )}
                      {/* Ayah end marker */}
                      {wordStatus.isLastWord && (
                        <span className="inline-flex items-center justify-center w-6 h-6 mx-1 text-xs rounded-full border border-primary/30 text-primary font-sans">
                          {wordStatus.ayahIndex + 1}
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
          const hasIncorrect = wordStatuses.some(w => w.status === 'incorrect');
          const appreciation = getRandomAppreciation(allComplete, hasIncorrect);
          const progressPercent = Math.round((spokenWordsCount / wordStatuses.length) * 100);
          const incorrectCount = wordStatuses.filter(w => w.status === 'incorrect').length;
          
          return (
            <div className={cn(
              "text-center p-6 md:p-8 rounded-2xl slide-up",
              hasIncorrect 
                ? "bg-amber-500/10 border border-amber-500/20" 
                : "bg-success/10 border border-success/20"
            )}>
              <p className="text-3xl mb-2">{appreciation.emoji}</p>
              <h3 className={cn(
                "text-lg md:text-xl font-bold mb-2",
                hasIncorrect ? "text-amber-600" : "text-success"
              )}>
                {appreciation.title}
              </h3>
              <p className="text-muted-foreground text-sm md:text-base">
                {allComplete && !hasIncorrect
                  ? `Anda telah menyelesaikan hafalan Surah ${surah.englishName} dengan sempurna. Semoga berkah!` 
                  : hasIncorrect 
                    ? `Ada ${incorrectCount} kata yang terlewat. Progres: ${progressPercent}%. Coba lagi ya!`
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
