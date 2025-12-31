import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { RefreshCw, Volume2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { VoiceIndicator } from '@/components/VoiceIndicator';
import { ValidationBadge } from '@/components/ValidationBadge';
import { AyahDisplay } from '@/components/AyahDisplay';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import {
  fetchSurahDetail,
  SurahDetail,
  findBestMatchingAyah,
  ValidationResult,
} from '@/lib/quran-api';
import { Button } from '@/components/ui/button';

const RecitePage = () => {
  const { surahNumber } = useParams<{ surahNumber: string }>();
  const [surah, setSurah] = useState<SurahDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [showAyah, setShowAyah] = useState(false);
  const [matchedAyahText, setMatchedAyahText] = useState<string>('');

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
      setShowAyah(false);
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript]);

  // Validate when transcript changes and user stops speaking
  useEffect(() => {
    if (!surah || !transcript || isListening) return;

    // Find the best matching ayah
    const match = findBestMatchingAyah(
      transcript,
      surah.ayahs,
      currentAyahIndex + 1
    );

    if (match) {
      setValidationResult(match.validation);
      setMatchedAyahText(match.ayah.text);
      setShowAyah(true);

      // If valid, move to next ayah
      if (match.validation.isValid) {
        setCurrentAyahIndex(match.ayah.numberInSurah);
      }
    }
  }, [transcript, isListening, surah, currentAyahIndex]);

  // Reset for next ayah
  const handleNextAyah = useCallback(() => {
    resetTranscript();
    setValidationResult(null);
    setShowAyah(false);
    startListening();
  }, [resetTranscript, startListening]);

  // Retry current ayah
  const handleRetry = useCallback(() => {
    resetTranscript();
    setValidationResult(null);
    setShowAyah(false);
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
    <div className="min-h-screen bg-background islamic-pattern">
      <Header title={surah.name} subtitle={surah.englishName} showBack />

      <main className="container py-8 pb-32">
        {/* Progress */}
        <div className="mb-8 fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              Ayat {currentAyahIndex + 1} dari {surah.numberOfAyahs}
            </span>
            <span className="text-sm font-semibold text-primary">
              {Math.round((currentAyahIndex / surah.numberOfAyahs) * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(currentAyahIndex / surah.numberOfAyahs) * 100}%` }}
            />
          </div>
        </div>

        {/* Voice Recognition Area */}
        <div className="flex flex-col items-center justify-center py-8">
          {/* Status Message */}
          <div className="text-center mb-8">
            {!isListening && !validationResult && (
              <p className="text-muted-foreground fade-in">
                Tekan tombol mikrofon untuk mulai membaca
              </p>
            )}
            {isListening && (
              <div className="fade-in">
                <p className="text-primary font-semibold mb-2">
                  🎙️ Mendengarkan...
                </p>
                <p className="text-sm text-muted-foreground">
                  Silakan baca ayat ke-{currentAyahIndex + 1}
                </p>
              </div>
            )}
          </div>

          {/* Voice Button */}
          <VoiceIndicator isListening={isListening} onClick={handleVoiceToggle} />

          {/* Live Transcript */}
          {(transcript || interimTranscript) && (
            <div className="mt-8 w-full max-w-lg fade-in">
              <div className="p-4 rounded-xl bg-card border border-border">
                <p className="text-xs text-muted-foreground mb-2 text-center">
                  Bacaan Anda:
                </p>
                <p className="font-arabic text-xl text-center text-foreground" dir="rtl">
                  {transcript} <span className="text-muted-foreground/50">{interimTranscript}</span>
                </p>
              </div>
            </div>
          )}

          {/* Speech Error */}
          {speechError && (
            <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 fade-in">
              <p className="text-sm text-destructive text-center">{speechError}</p>
            </div>
          )}
        </div>

        {/* Validation Result */}
        {validationResult && showAyah && (
          <div className="mt-8 space-y-6 slide-up">
            {/* Badge */}
            <div className="flex justify-center">
              <ValidationBadge
                isValid={validationResult.isValid}
                matchPercentage={validationResult.matchPercentage}
              />
            </div>

            {/* Message */}
            <p className="text-center text-foreground font-semibold">
              {validationResult.message}
            </p>

            {/* Ayah Display with Highlighting */}
            <AyahDisplay
              ayahText={matchedAyahText}
              wordResults={validationResult.wordResults}
              ayahNumber={validationResult.ayahNumber}
            />

            {/* Action Buttons */}
            <div className="flex justify-center gap-4">
              {!validationResult.isValid && (
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Ulangi
                </Button>
              )}
              {currentAyahIndex < surah.numberOfAyahs && (
                <Button onClick={handleNextAyah} className="btn-islamic gap-2">
                  <Volume2 className="w-4 h-4" />
                  Ayat Selanjutnya
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Completion Message */}
        {currentAyahIndex >= surah.numberOfAyahs && (
          <div className="mt-12 text-center p-8 rounded-2xl bg-success/10 border border-success/20 slide-up">
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

      {/* Footer Note */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border py-3">
        <div className="container">
          <p className="text-xs text-center text-muted-foreground">
            ⚠️ Sistem ini hanya alat bantu hafalan, bukan penentu hukum tajwid.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default RecitePage;
