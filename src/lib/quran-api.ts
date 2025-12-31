export interface Surah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  numberOfAyahs: number;
  revelationType: string;
}

export interface Ayah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
}

export interface SurahDetail {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: string;
  numberOfAyahs: number;
  ayahs: Ayah[];
}

const BASE_URL = 'https://api.alquran.cloud/v1';

export async function fetchAllSurahs(): Promise<Surah[]> {
  const response = await fetch(`${BASE_URL}/surah`);
  const data = await response.json();
  
  if (data.code !== 200) {
    throw new Error('Failed to fetch surahs');
  }
  
  return data.data;
}

export async function fetchSurahDetail(surahNumber: number): Promise<SurahDetail> {
  const response = await fetch(`${BASE_URL}/surah/${surahNumber}/ar`);
  const data = await response.json();
  
  if (data.code !== 200) {
    throw new Error('Failed to fetch surah detail');
  }
  
  return data.data;
}

// Normalization function for Arabic text comparison
export function normalizeArabic(text: string): string {
  let normalized = text;
  
  // Remove tashkeel (harakat)
  normalized = normalized.replace(/[\u064B-\u065F\u0670]/g, '');
  
  // Remove tatweel
  normalized = normalized.replace(/\u0640/g, '');
  
  // Normalize hamza variants to alif
  normalized = normalized.replace(/[أإآٱ]/g, 'ا');
  
  // Normalize taa marbuta to haa
  normalized = normalized.replace(/ة/g, 'ه');
  
  // Normalize alif maksura to yaa
  normalized = normalized.replace(/ى/g, 'ي');
  
  // Remove waqf signs and other marks
  normalized = normalized.replace(/[\u06D6-\u06ED]/g, '');
  
  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

// Word-by-word comparison
export interface ValidationResult {
  isValid: boolean;
  matchPercentage: number;
  wordResults: WordResult[];
  ayahNumber: number;
  message: string;
}

export interface WordResult {
  word: string;
  expected: string;
  isCorrect: boolean;
  position: number;
}

export function validateRecitation(
  userText: string,
  referenceAyah: string,
  ayahNumber: number
): ValidationResult {
  const normalizedUser = normalizeArabic(userText);
  const normalizedReference = normalizeArabic(referenceAyah);
  
  const userWords = normalizedUser.split(' ').filter(w => w.length > 0);
  const referenceWords = normalizedReference.split(' ').filter(w => w.length > 0);
  
  const wordResults: WordResult[] = [];
  let correctCount = 0;
  
  // Simple word-by-word comparison
  const maxLength = Math.max(userWords.length, referenceWords.length);
  
  for (let i = 0; i < maxLength; i++) {
    const userWord = userWords[i] || '';
    const refWord = referenceWords[i] || '';
    
    const isCorrect = userWord === refWord;
    if (isCorrect) correctCount++;
    
    wordResults.push({
      word: userWord,
      expected: refWord,
      isCorrect,
      position: i,
    });
  }
  
  const matchPercentage = referenceWords.length > 0 
    ? (correctCount / referenceWords.length) * 100 
    : 0;
  
  const isValid = matchPercentage >= 85;
  
  const message = isValid
    ? `MasyaAllah, bacaan ayat ke-${ayahNumber} sudah benar!`
    : `Perhatikan bacaan pada ayat ke-${ayahNumber}`;
  
  return {
    isValid,
    matchPercentage,
    wordResults,
    ayahNumber,
    message,
  };
}

// Find best matching ayah from a list
export function findBestMatchingAyah(
  userText: string,
  ayahs: Ayah[],
  startFromAyah: number = 1
): { ayah: Ayah; validation: ValidationResult } | null {
  const relevantAyahs = ayahs.filter(a => a.numberInSurah >= startFromAyah);
  
  let bestMatch: { ayah: Ayah; validation: ValidationResult } | null = null;
  let highestPercentage = 0;
  
  for (const ayah of relevantAyahs) {
    const validation = validateRecitation(userText, ayah.text, ayah.numberInSurah);
    
    if (validation.matchPercentage > highestPercentage) {
      highestPercentage = validation.matchPercentage;
      bestMatch = { ayah, validation };
    }
  }
  
  return bestMatch;
}
