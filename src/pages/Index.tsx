import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { Header } from '@/components/Header';
import { SurahCard } from '@/components/SurahCard';
import { fetchAllSurahs, Surah } from '@/lib/quran-api';
import { Input } from '@/components/ui/input';

const Index = () => {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function loadSurahs() {
      try {
        const data = await fetchAllSurahs();
        setSurahs(data);
        setFilteredSurahs(data);
      } catch (err) {
        setError('Gagal memuat daftar surah. Silakan coba lagi.');
      } finally {
        setIsLoading(false);
      }
    }
    loadSurahs();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredSurahs(surahs);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredSurahs(
        surahs.filter(
          (surah) =>
            surah.name.includes(searchQuery) ||
            surah.englishName.toLowerCase().includes(query) ||
            surah.number.toString().includes(query)
        )
      );
    }
  }, [searchQuery, surahs]);

  const handleSurahClick = (surah: Surah) => {
    navigate(`/recite/${surah.number}`);
  };

  return (
    <div className="min-h-screen bg-background islamic-pattern">
      <Header />

      <main className="container py-6 pb-24">
        {/* Hero Section */}
        <div className="text-center mb-8 fade-in">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2 font-arabic">
            بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            Pilih surah untuk memulai hafalan. Bacaan Anda akan divalidasi secara otomatis.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6 fade-in">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari surah..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-card border-border h-12 rounded-xl"
          />
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <p className="mt-4 text-muted-foreground">Memuat daftar surah...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-20">
            <p className="text-destructive mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="btn-islamic px-6 py-3 rounded-xl"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Surah List */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSurahs.map((surah, index) => (
              <div
                key={surah.number}
                className="fade-in"
                style={{ animationDelay: `${Math.min(index, 20) * 30}ms` }}
              >
                <SurahCard surah={surah} onClick={() => handleSurahClick(surah)} />
              </div>
            ))}

            {filteredSurahs.length === 0 && (
              <div className="text-center py-12 col-span-full">
                <p className="text-muted-foreground">
                  Tidak ada surah yang ditemukan untuk "{searchQuery}"
                </p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Note */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/90 backdrop-blur-lg border-t border-border py-3">
        <div className="container">
          <p className="text-xs text-center text-muted-foreground">
            ⚠️ Sistem ini hanya alat bantu hafalan, bukan penentu hukum tajwid.
            Tetap belajar dengan guru.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
