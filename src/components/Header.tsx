import { ArrowLeft, Moon, Sun, Info } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';

const LOGO_LIGHT = 'https://2zojb93ygj.ucarecd.net/726bd684-244a-4f39-bb6d-5ee039317381/haflinlogohitam.png';
const LOGO_DARK = 'https://2zojb93ygj.ucarecd.net/3413237b-725e-4812-bdf1-f110fc18ecd0/haflinlogoputih.png';

interface HeaderProps {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  minimalMode?: boolean;
}

export function Header({ title, subtitle, showBack = false, minimalMode = false }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  }, []);

  const InfoContent = () => (
    <div className="space-y-5 text-center">
      <p className="text-base text-foreground leading-relaxed">
        <strong>Hafalin</strong> adalah website bantu hafalan Al-Qur'an dengan teknologi pengenalan suara. 
        Tinggal baca ayat yang mau dihafal, dan bacaanmu akan dicek langsung. 
        Praktis, simpel, dan bikin proses menghafal jadi lebih nyaman dimana saja kapan saja.
      </p>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">
          ⚠️ Penting: Website ini hanya alat bantu hafalan, bukan penentu hukum tajwid. 
          Tetap belajar dengan guru yang berkompeten untuk hasil terbaik.
        </p>
      </div>

      <div className="pt-3 border-t border-border">
        <p className="text-sm text-muted-foreground mb-2">Dibuat dengan ❤️ oleh</p>
        <p className="font-semibold text-foreground">akhirpetang</p>
      </div>

      <div className="flex items-center justify-center gap-4 pt-2">
        <a
          href="https://facebook.com/akhirpetang"
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        </a>
        <a
          href="https://instagram.com/akhirpetang"
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        </a>
        <a
          href="https://twitter.com/akhirpetang"
          target="_blank"
          rel="noopener noreferrer"
          className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="container py-4">
        <div className="flex items-center gap-4">
          {showBack && location.pathname !== '/' && (
            <button
              onClick={() => navigate('/')}
              className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
          )}
          
          {/* Logo only - no text, no background */}
          {!minimalMode && (
            <div className="flex-1 flex items-center gap-3">
              <img 
                src={isDark ? LOGO_DARK : LOGO_LIGHT} 
                alt="Hafalin" 
                className="h-10 w-auto sm:h-12 md:h-14 object-contain"
              />
            </div>
          )}

          {/* Spacer for minimal mode */}
          {minimalMode && <div className="flex-1" />}

          {/* Right Icons - hidden in minimal mode */}
          {!minimalMode && (
            <div className="flex items-center gap-2">
              {/* Info Icon - Mobile uses Drawer, Desktop uses Dialog */}
              {isMobile ? (
                <Drawer>
                  <DrawerTrigger asChild>
                    <button className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                      <Info className="w-5 h-5 text-foreground" />
                    </button>
                  </DrawerTrigger>
                  <DrawerContent className="rounded-t-3xl">
                    <DrawerHeader>
                      <DrawerTitle className="text-center text-xl font-bold">Tentang Hafalin</DrawerTitle>
                    </DrawerHeader>
                    <div className="px-4 pb-8">
                      <InfoContent />
                    </div>
                  </DrawerContent>
                </Drawer>
              ) : (
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                      <Info className="w-5 h-5 text-foreground" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md rounded-t-3xl rounded-b-3xl">
                    <DialogHeader>
                      <DialogTitle className="text-center text-xl font-bold">Tentang Hafalin</DialogTitle>
                    </DialogHeader>
                    <InfoContent />
                  </DialogContent>
                </Dialog>
              )}

              {/* Dark Mode Toggle */}
              <button
                onClick={toggleDarkMode}
                className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
              >
                {isDark ? (
                  <Sun className="w-5 h-5 text-foreground" />
                ) : (
                  <Moon className="w-5 h-5 text-foreground" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
