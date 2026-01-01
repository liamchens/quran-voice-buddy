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
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const shouldRestartRef = useRef(false);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'ar-SA'; // Arabic (Saudi Arabia)
      recognition.maxAlternatives = 1;
      
      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        shouldRestartRef.current = true;
      };
      
      recognition.onend = () => {
        // Auto-restart if should still be listening (prevents page disappearing issue)
        if (shouldRestartRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            try {
              recognition.start();
            } catch (e) {
              // Ignore restart errors
              setIsListening(false);
            }
          }, 300);
        } else {
          setIsListening(false);
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        // Handle specific errors gracefully
        const errorType = event.error;
        
        // These errors are recoverable - just restart
        if (errorType === 'no-speech' || errorType === 'aborted' || errorType === 'network') {
          if (shouldRestartRef.current) {
            restartTimeoutRef.current = setTimeout(() => {
              try {
                recognition.start();
              } catch (e) {
                // Ignore
              }
            }, 500);
          }
          return;
        }
        
        // Not-allowed means user denied permission
        if (errorType === 'not-allowed') {
          setError('Izin mikrofon ditolak. Silakan izinkan akses mikrofon.');
          shouldRestartRef.current = false;
          setIsListening(false);
          return;
        }
        
        // Other errors - show but don't crash
        setError(`Error: ${event.error}`);
      };
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const now = Date.now();
        
        // Throttle updates on mobile (min 150ms between updates)
        if (now - lastUpdateRef.current < 150) {
          return;
        }
        lastUpdateRef.current = now;
        
        let finalTranscript = '';
        let interim = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const confidence = result[0].confidence;
          
          // Only accept results with reasonable confidence (>0.3)
          if (confidence === undefined || confidence > 0.3) {
            if (result.isFinal) {
              finalTranscript += result[0].transcript;
            } else {
              interim += result[0].transcript;
            }
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
      shouldRestartRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, []);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      shouldRestartRef.current = true;
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Recognition might already be started
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    shouldRestartRef.current = false;
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    setIsListening(false);
  }, []);

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
