import { useState, useEffect, useCallback, useRef } from 'react';

interface UseSpeechRecognitionReturn {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// Extend Window interface for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);

  // Track user intent: keep listening until user presses stop
  const shouldBeListeningRef = useRef(false);
  const restartTimeoutRef = useRef<number | null>(null);
  const restartAttemptsRef = useRef(0);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ar-SA'; // Arabic (Saudi Arabia)
      
      recognition.onstart = () => {
        setIsListening(true);
        restartAttemptsRef.current = 0;
        setError(null);
      };
      
      recognition.onend = () => {
        // Chrome mobile sering berhenti sendiri saat hening.
        // Kalau user belum menekan stop, kita auto-restart supaya tetap listening.
        if (shouldBeListeningRef.current) {
          // Tetap tampilkan status "mendengarkan" di UI
          setIsListening(true);

          if (restartTimeoutRef.current) {
            window.clearTimeout(restartTimeoutRef.current);
          }

          const attempt = restartAttemptsRef.current;
          const delayMs = Math.min(1500, 250 + attempt * 250);

          restartTimeoutRef.current = window.setTimeout(() => {
            try {
              recognition.start();
            } catch {
              // ignore - bisa terjadi kalau start dipanggil saat masih dianggap aktif
            }
          }, delayMs);

          restartAttemptsRef.current = Math.min(restartAttemptsRef.current + 1, 6);
          return;
        }

        setIsListening(false);
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Jangan langsung mematikan sesi kalau error yang umum di mobile (no-speech/aborted).
        // Tetap restart kalau user masih ingin listening.
        const err = event.error;

        if (shouldBeListeningRef.current && (err === 'no-speech' || err === 'aborted' || err === 'network' || err === 'audio-capture')) {
          return;
        }

        setError(`Error: ${event.error}`);
        shouldBeListeningRef.current = false;
        setIsListening(false);
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interim = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscript(prev => prev + ' ' + finalTranscript);
        }
        setInterimTranscript(interim);
      };
      
      recognitionRef.current = recognition;
    } else {
      setIsSupported(false);
      setError('Browser tidak mendukung Speech Recognition');
    }
    
    return () => {
      if (restartTimeoutRef.current) {
        window.clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        shouldBeListeningRef.current = false;
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      shouldBeListeningRef.current = true;

      try {
        recognitionRef.current.start();
      } catch {
        // Recognition might already be started
      }
    } else if (recognitionRef.current && isListening) {
      // Already listening, but ensure intent is set
      shouldBeListeningRef.current = true;
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (restartTimeoutRef.current) {
      window.clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    shouldBeListeningRef.current = false;

    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, [isListening]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript: transcript.trim(),
    interimTranscript,
    error,
    isSupported,
    startListening,
    stopListening,
    resetTranscript,
  };
}
