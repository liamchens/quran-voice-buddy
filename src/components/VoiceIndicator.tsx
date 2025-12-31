import { Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceIndicatorProps {
  isListening: boolean;
  onClick: () => void;
}

export function VoiceIndicator({ isListening, onClick }: VoiceIndicatorProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative w-16 h-16 md:w-24 md:h-24 rounded-full flex items-center justify-center transition-all duration-300',
        isListening
          ? 'btn-islamic listening-indicator'
          : 'bg-secondary hover:bg-secondary/80'
      )}
    >
      {/* Ripple effect when listening */}
      {isListening && (
        <>
          <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
          <span className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
        </>
      )}
      
      {/* Icon */}
      {isListening ? (
        <Mic className="w-7 h-7 md:w-10 md:h-10 text-primary-foreground relative z-10" />
      ) : (
        <MicOff className="w-7 h-7 md:w-10 md:h-10 text-muted-foreground" />
      )}
    </button>
  );
}
