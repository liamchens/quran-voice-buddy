import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { VoiceIndicator } from '@/components/VoiceIndicator';
import { ValidationBadge } from '@/components/ValidationBadge';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  fetchSurahDetail,
  SurahDetail,
  validateRecitation,
  ValidationResult,
  normalizeArabic,
} from '@/lib/quran-api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const RecitePage = () => {
  const { surahNumber } = useParams<{ surahNumber: string }>();
  const [surah, setSurah] = useState<SurahDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

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

  // Current ayah
  const currentAyah = useMemo(() => {
    return surah?.ayahs[currentAyahIndex];
  }, [surah, currentAyahIndex]);

  // Split current ayah into words with original text
  const ayahWords = useMemo(() => {
    if (!currentAyah) return [];
    return currentAyah.text.split(' ').filter(w => w.length > 0);
  }, [currentAyah]);

  // Real-time word matching
  const liveWordResults = useMemo(() => {
    if (!currentAyah || (!transcript && !interimTranscript)) return null;
    
    const fullTranscript = (transcript + ' ' + interimTranscript).trim();
    if (!fullTranscript) return null;
    
    const normalizedUser = normalizeArabic(fullTranscript);
    const userWords = normalizedUser.split(' ').filter(w => w.length > 0);
    
    const normalizedAyah = normalizeArabic(currentAyah.text);
    const referenceWords = normalizedAyah.split(' ').filter(w => w.length > 0);
    
    return ayahWords.map((originalWord, index) => {
      const refWord = referenceWords[index] || '';
      const userWord = userWords[index];
      
      if (userWord === undefined) {
        // Not yet spoken
        return { originalWord, status: 'pending' as const };
      }
      
      const isCorrect = userWord === refWord;
      return { 
        originalWord, 
        status: isCorrect ? 'correct' as const : 'incorrect' as const,
        userWord 
      };
    });
  }, [currentAyah, transcript, interimTranscript, ayahWords]);

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
      setValidationResult(null);
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  // Validate when user stops speaking
  useEffect(() => {
    if (!currentAyah || !transcript || isListening) return;

    const result = validateRecitation(transcript, currentAyah.text, currentAyah.numberInSurah);
    setValidationResult(result);
  }, [transcript, isListening, currentAyah]);

  // Navigate to next ayah
  const handleNextAyah = useCallback(() => {
    if (!surah) return;
    if (currentAyahIndex < surah.numberOfAyahs - 1) {
      setCurrentAyahIndex(prev => prev + 1);
      resetTranscript();
      setValidationResult(null);
    }
  }, [currentAyahIndex, surah, resetTranscript]);

  // Navigate to previous ayah
  const handlePrevAyah = useCallback(() => {
    if (currentAyahIndex > 0) {
      setCurrentAyahIndex(prev => prev - 1);
      resetTranscript();
      setValidationResult(null);
    }
  }, [currentAyahIndex, resetTranscript]);

  // Retry current ayah
  const handleRetry = useCallback(() => {
    resetTranscript();
    setValidationResult(null);
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
      <Header title={surah.name} subtitle={`${surah.englishName} • Ayat ${currentAyahIndex + 1}`} showBack />

      <main className="container py-6 pb-40">
        {/* Ayah Display - Tarteel Style */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6 fade-in">
          {/* Surah Title */}
          <div className="text-center mb-6 pb-4 border-b border-border">
            <p className="font-arabic text-xl text-primary">{surah.name}</p>
          </div>

          {/* Bismillah for first ayah (except Al-Fatihah and At-Taubah) */}
          {currentAyahIndex === 0 && parseInt(surahNumber || '1') !== 1 && parseInt(surahNumber || '1') !== 9 && (
            <p className="font-arabic text-xl text-center text-muted-foreground mb-6" dir="rtl">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
          )}

          {/* Ayah Text with Live Highlighting */}
          <div className="text-center">
            <p className="font-arabic text-2xl md:text-3xl leading-[2.5] text-right" dir="rtl">
              {liveWordResults ? (
                // Live highlighting while speaking
                liveWordResults.map((result, index) => (
                  <span
                    key={index}
                    className={cn(
                      'mx-0.5 px-1 rounded transition-all duration-200',
                      result.status === 'correct' && 'text-success bg-success/15',
                      result.status === 'incorrect' && 'text-destructive bg-destructive/15 underline decoration-wavy',
                      result.status === 'pending' && 'text-foreground'
                    )}
                  >
                    {result.originalWord}
                  </span>
                ))
              ) : validationResult ? (
                // Final result highlighting
                validationResult.wordResults.map((result, index) => (
                  <span
                    key={index}
                    className={cn(
                      'mx-0.5 px-1 rounded transition-all duration-200',
                      result.isCorrect 
                        ? 'text-success bg-success/15' 
                        : 'text-destructive bg-destructive/15 underline decoration-wavy'
                    )}
                  >
                    {result.originalExpected}
                  </span>
                ))
              ) : (
                // Plain text before speaking
                ayahWords.map((word, index) => (
                  <span key={index} className="mx-0.5">
                    {word}
                  </span>
                ))
              )}
              {/* Ayah number marker */}
              <span className="inline-flex items-center justify-center w-8 h-8 mx-2 text-sm rounded-full bg-primary/10 text-primary font-sans">
                {currentAyahIndex + 1}
              </span>
            </p>
          </div>
        </div>

        {/* Validation Result Badge */}
        {validationResult && (
          <div className="flex flex-col items-center gap-4 mb-6 slide-up">
            <ValidationBadge
              isValid={validationResult.isValid}
              matchPercentage={validationResult.matchPercentage}
            />
            <p className="text-center text-foreground font-medium text-sm">
              {validationResult.message}
            </p>
            
            {/* Retry button for invalid */}
            {!validationResult.isValid && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Ulangi
              </Button>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button
            variant="outline"
            onClick={handlePrevAyah}
            disabled={currentAyahIndex === 0}
            className="gap-2"
          >
            <ChevronRight className="w-4 h-4" />
            Sebelumnya
          </Button>
          
          <span className="text-sm text-muted-foreground">
            {currentAyahIndex + 1} / {surah.numberOfAyahs}
          </span>
          
          <Button
            variant="outline"
            onClick={handleNextAyah}
            disabled={currentAyahIndex >= surah.numberOfAyahs - 1}
            className="gap-2"
          >
            Selanjutnya
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>

        {/* Speech Error */}
        {speechError && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 mb-6 fade-in">
            <p className="text-sm text-destructive text-center">{speechError}</p>
          </div>
        )}

        {/* Completion Message */}
        {currentAyahIndex >= surah.numberOfAyahs - 1 && validationResult?.isValid && (
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
