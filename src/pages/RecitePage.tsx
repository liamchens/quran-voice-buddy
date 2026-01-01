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

  // Hasil validasi & apresiasi hanya tampil setelah user menekan STOP
  const [userStopped, setUserStopped] = useState(false);

  // Word statuses - managed as state for Tarteel-style incremental matching
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const lastProcessedCountRef = useRef(0);


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
    lastProcessedCountRef.current = 0;
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
    const lastProcessedCount = lastProcessedCountRef.current;
    if (userWords.length <= lastProcessedCount) return;

    const newWords = userWords.slice(lastProcessedCount);

    // Process each new word one by one
    let newCurrentIndex = currentWordIndex;
    const updatedStatuses = [...wordStatuses];
    let processedInThisRun = 0;

    for (let wIdx = 0; wIdx < newWords.length; wIdx++) {
      const userWord = newWords[wIdx];

      if (newCurrentIndex >= wordStatuses.length) {
        processedInThisRun++;
        continue;
      }

      const currentRef = wordStatuses[newCurrentIndex];

      // TOLERAN (dalam ayat): fokus ke hafalan, bukan tajwid
      // Tapi AWAL AYAT harus lebih ketat supaya ayat berikutnya tidak kebuka karena noise.
      const isAyahStart =
        newCurrentIndex === 0 || wordStatuses[newCurrentIndex - 1]?.isLastWord;

      const baseThreshold = isAyahStart ? 60 : 40;
      const shortWordBoost = (currentRef.normalized?.length || 0) <= 2 ? 20 : 0;
      const CURRENT_MATCH_THRESHOLD = Math.min(85, baseThreshold + shortWordBoost);

      // KETAT untuk skip: hanya tandai "terlewat" kalau benar-benar yakin user lompat.
      // Dibuat ekstra ketat saat pindah ayat supaya ayat berikutnya tidak kebuka karena noise.
      const SKIP_DETECT_THRESHOLD_SAME_AYAH = 85;
      const SKIP_DETECT_THRESHOLD_NEXT_AYAH = 92;
      const SKIP_CONFIRM_THRESHOLD_SAME_AYAH = 70;
      const SKIP_CONFIRM_THRESHOLD_NEXT_AYAH = 85;

      const currentSimilarity = calculateSimilarity(userWord, currentRef.normalized);

      if (currentSimilarity >= CURRENT_MATCH_THRESHOLD) {
        // Anti-bocor ayat: kalau ini awal ayat, butuh konfirmasi 2 kata supaya noise 1 kata
        // tidak langsung membuka ayat berikutnya.
        if (isAyahStart) {
          const nextExpectedStart = wordStatuses[newCurrentIndex + 1]?.normalized;
          const nextUserWordStart = newWords[wIdx + 1];

          // Kalau belum ada kata berikutnya, tunggu dulu (jangan advance)
          if (nextExpectedStart && !nextUserWordStart) {
            break;
          }

          if (nextExpectedStart && nextUserWordStart) {
            const nextSimStart = calculateSimilarity(nextUserWordStart, nextExpectedStart);
            const START_CONFIRM_THRESHOLD = 45;

            if (nextSimStart < START_CONFIRM_THRESHOLD) {
              // Kemungkinan noise yang kebetulan mirip kata pertama -> abaikan
              processedInThisRun++;
              continue;
            }
          }
        }

        updatedStatuses[newCurrentIndex] = {
          ...currentRef,
          status: 'correct',
        };
        newCurrentIndex++;
        processedInThisRun++;
        continue;
      }

      // Cek skip hanya di window kecil (hemat & stabil)
      const currentAyah = currentRef.ayahIndex;
      let foundAhead = -1;

      for (let i = newCurrentIndex + 1; i < Math.min(newCurrentIndex + 6, wordStatuses.length); i++) {
        const sameAyah = wordStatuses[i].ayahIndex === currentAyah;
        const isNextAyahFirstWord =
          currentRef.isLastWord &&
          i === newCurrentIndex + 1 &&
          wordStatuses[i].ayahIndex === currentAyah + 1;

        if (!sameAyah && !isNextAyahFirstWord) break;

        const candidate = wordStatuses[i];
        const isCrossAyah = isNextAyahFirstWord;
        const minLen = isCrossAyah ? 4 : 3;
        if ((candidate.normalized?.length || 0) < minLen) continue;

        const detectThreshold = isCrossAyah
          ? SKIP_DETECT_THRESHOLD_NEXT_AYAH
          : SKIP_DETECT_THRESHOLD_SAME_AYAH;

        const aheadSimilarity = calculateSimilarity(userWord, candidate.normalized);
        if (aheadSimilarity >= detectThreshold) {
          foundAhead = i;
          break;
        }
      }

      if (foundAhead !== -1) {
        const nextUserWord = newWords[wIdx + 1];
        const nextExpected = wordStatuses[foundAhead + 1]?.normalized;

        // Kalau belum ada kata berikutnya, JANGAN putuskan "terlewat" dulu.
        // Kita tunggu update transcript berikutnya biar tidak false-positive.
        if (!nextUserWord) {
          break;
        }

        const nextSimilarity = nextExpected
          ? calculateSimilarity(nextUserWord, nextExpected)
          : 0;

        const isCrossAyahJump =
          currentRef.isLastWord &&
          wordStatuses[foundAhead].ayahIndex === currentAyah + 1;

        const baseConfirmThreshold = isCrossAyahJump
          ? SKIP_CONFIRM_THRESHOLD_NEXT_AYAH
          : SKIP_CONFIRM_THRESHOLD_SAME_AYAH;

        const nextLen = nextExpected?.length || 0;
        const confirmBoost = nextLen <= 2 ? 10 : 0;
        const requiredConfirm = Math.min(95, baseConfirmThreshold + confirmBoost);

        if (nextExpected && nextSimilarity >= requiredConfirm) {
          // User benar-benar lompat -> tandai kata yang dilewati sebagai incorrect
          for (let i = newCurrentIndex; i < foundAhead; i++) {
            const sameAyah = wordStatuses[i].ayahIndex === currentAyah;
            const isNextAyahFirstWord =
              currentRef.isLastWord &&
              i === newCurrentIndex + 1 &&
              wordStatuses[i].ayahIndex === currentAyah + 1;

            if (!sameAyah && !isNextAyahFirstWord) break;

            updatedStatuses[i] = {
              ...wordStatuses[i],
              status: 'incorrect',
            };
          }

          updatedStatuses[foundAhead] = {
            ...wordStatuses[foundAhead],
            status: 'correct',
          };
          newCurrentIndex = foundAhead + 1;
          processedInThisRun++;
          continue;
        }
      }

      // Fallback: kalau user benar-benar lompat beberapa ayat ke depan (misal dari ayat 6 ke ayat 7/9),
      // kita cari "awal ayat" berikutnya yang match sangat tinggi dan dikonfirmasi 2 kata.
      // Tujuannya: ayat yang dibaca user tetap muncul (tidak dianggap noise).
      if (foundAhead === -1 && isAyahStart) {
        const nextUserWord = newWords[wIdx + 1];
        if (!nextUserWord) {
          // butuh 2 kata untuk konfirmasi
          break;
        }

        const LONG_JUMP_MAX_AYAHS_AHEAD = 12;
        const LONG_JUMP_DETECT_THRESHOLD = 95;
        const LONG_JUMP_CONFIRM_THRESHOLD = 60;

        let bestIdx = -1;
        let bestSim = 0;

        for (let i = newCurrentIndex + 1; i < wordStatuses.length; i++) {
          const ayahIdx = wordStatuses[i].ayahIndex;
          if (ayahIdx <= currentAyah + 1) continue; // biarkan next-ayah ditangani oleh logic biasa
          if (ayahIdx > currentAyah + LONG_JUMP_MAX_AYAHS_AHEAD) break;

          const isStart = i === 0 || wordStatuses[i - 1]?.isLastWord;
          if (!isStart) continue;

          const cand = wordStatuses[i];
          if ((cand.normalized?.length || 0) < 4) continue;

          const sim = calculateSimilarity(userWord, cand.normalized);
          if (sim > bestSim) {
            bestSim = sim;
            bestIdx = i;
          }
        }

        if (bestIdx !== -1 && bestSim >= LONG_JUMP_DETECT_THRESHOLD) {
          const nextExpected = wordStatuses[bestIdx + 1]?.normalized;
          const nextSim = nextExpected
            ? calculateSimilarity(nextUserWord, nextExpected)
            : 0;

          if (!nextExpected || nextSim >= LONG_JUMP_CONFIRM_THRESHOLD) {
            for (let i = newCurrentIndex; i < bestIdx; i++) {
              updatedStatuses[i] = {
                ...wordStatuses[i],
                status: 'incorrect',
              };
            }

            updatedStatuses[bestIdx] = {
              ...wordStatuses[bestIdx],
              status: 'correct',
            };

            newCurrentIndex = bestIdx + 1;
            processedInThisRun++;
            continue;
          }
        }
      }

      // Kalau tidak match DAN tidak terkonfirmasi skip -> anggap noise dari STT.
      // Jangan advance; tapi kata user tetap dianggap "diproses" supaya tidak nyangkut.
      processedInThisRun++;
    }

    // Update state
    if (newCurrentIndex !== currentWordIndex) {
      setWordStatuses(updatedStatuses);
      setCurrentWordIndex(newCurrentIndex);
    }

    lastProcessedCountRef.current = lastProcessedCount + processedInThisRun;
    
  }, [transcript, isListening, wordStatuses, currentWordIndex]);

  // Check how many words have been spoken
  const spokenWordsCount = useMemo(() => {
    return wordStatuses.filter(w => w.status !== 'pending').length;
  }, [wordStatuses]);

  // Check if all words are complete (only when we reached the final word)
  const allComplete = useMemo(() => {
    return wordStatuses.length > 0 && currentWordIndex >= wordStatuses.length;
  }, [wordStatuses.length, currentWordIndex]);

  // Auto-stop HANYA jika sudah sampai ayat terakhir (selesai surah)
  // Catatan: di Chrome mobile, SpeechRecognition juga bisa berhenti sendiri saat hening;
  // itu ditangani di hook dengan auto-restart.
  useEffect(() => {
    if (allComplete && isListening) {
      setUserStopped(true);
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
    lastProcessedCountRef.current = 0;
  }, [surah]);

  // Handle voice toggle
  const handleVoiceToggle = useCallback(() => {
    if (isListening) {
      // User explicitly stops -> show results
      setUserStopped(true);
      stopListening();
    } else {
      // User explicitly starts -> hide results until stop
      setUserStopped(false);
      resetTranscript();
      resetWordStatuses();
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript, resetWordStatuses]);

  // Retry - reset transcript and word statuses
  const handleRetry = useCallback(() => {
    setUserStopped(false);
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

          {/* All Words - Horizontal Mushaf Style */}
          <div dir="rtl">
            {spokenWordsCount > 0 ? (
              <p className="font-arabic text-2xl md:text-3xl leading-[2.8] text-right">
                {wordStatuses.map((wordStatus, idx) => {
                  if (wordStatus.status === 'pending') return null;
                  
                  const isSkipped = wordStatus.status === 'incorrect';
                  
                  // Check if this is the first skipped word of an ayah (to show ayah label)
                  const isFirstSkippedInAyah = isSkipped && (
                    idx === 0 || 
                    wordStatuses[idx - 1]?.ayahIndex !== wordStatus.ayahIndex ||
                    wordStatuses[idx - 1]?.status !== 'incorrect'
                  );
                  
                  // Check if entire ayah was skipped
                  const ayahWords = wordStatuses.filter(w => w.ayahIndex === wordStatus.ayahIndex);
                  const allAyahSkipped = ayahWords.every(w => w.status === 'incorrect');
                  const someAyahSkipped = ayahWords.some(w => w.status === 'incorrect');
                  
                  return (
                    <span key={idx} className="relative group inline">
                      {/* Show "Ayat X Terlewat" label at start of skipped ayah */}
                      {isFirstSkippedInAyah && allAyahSkipped && (
                        <span className="inline-flex items-center gap-1 mx-2 px-2 py-0.5 text-xs bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-full font-sans whitespace-nowrap">
                          ⚠️ Ayat {wordStatus.ayahIndex + 1} Terlewat
                        </span>
                      )}
                      <span
                        className={cn(
                          'px-0.5 rounded transition-all duration-200',
                          wordStatus.status === 'correct' && 'text-success',
                          isSkipped && 'text-amber-500 bg-amber-500/10'
                        )}
                      >
                        {wordStatus.word}
                      </span>
                      {/* Tooltip for individual skipped words (within partially correct ayah) */}
                      {isSkipped && !allAyahSkipped && (
                        <span className="absolute -top-8 right-0 z-10 hidden group-hover:block bg-amber-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap font-sans">
                          Kata terlewat
                        </span>
                      )}
                      {/* Ayah end marker */}
                      {wordStatus.isLastWord && (
                        <span className={cn(
                          "inline-flex items-center justify-center w-6 h-6 mx-1 text-xs rounded-full border font-sans",
                          allAyahSkipped
                            ? "border-amber-500/50 text-amber-500 bg-amber-500/10"
                            : someAyahSkipped
                              ? "border-amber-500/30 text-amber-600"
                              : "border-primary/30 text-primary"
                        )}>
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
        {userStopped && spokenWordsCount > 0 && (() => {
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
