// Hardcoded ingredient substitution mappings
// Key: lowercase ingredient keyword → substitution options

export interface Substitution {
  name: string;
  ratio: string; // e.g. "1:1" or "100g → 80ml"
  note?: string;
}

const substitutionMap: Record<string, Substitution[]> = {
  // Dairy
  'tereyağı': [
    { name: 'Zeytinyağı', ratio: '100g → 80ml', note: 'Tatlılarda doku farkı yaratabilir' },
    { name: 'Hindistancevizi yağı', ratio: '1:1', note: 'Vegan alternatif' },
    { name: 'Margarin', ratio: '1:1' },
  ],
  'süt': [
    { name: 'Badem sütü', ratio: '1:1', note: 'Hafif cevizimsi aroma' },
    { name: 'Yulaf sütü', ratio: '1:1', note: 'Kremalı doku' },
    { name: 'Hindistancevizi sütü', ratio: '1:1', note: 'Daha yoğun' },
    { name: 'Soya sütü', ratio: '1:1' },
  ],
  'krema': [
    { name: 'Hindistancevizi kreması', ratio: '1:1' },
    { name: 'Kaju kreması', ratio: '1:1', note: 'Blenderda çekilmiş kaju + su' },
    { name: 'Yoğurt', ratio: '1:1', note: 'Daha ekşi' },
  ],
  'yoğurt': [
    { name: 'Hindistancevizi yoğurdu', ratio: '1:1', note: 'Vegan' },
    { name: 'Ekşi krema', ratio: '1:1' },
    { name: 'Labne', ratio: '1:1', note: 'Daha yoğun' },
  ],
  'peynir': [
    { name: 'Vegan peynir', ratio: '1:1' },
    { name: 'Tofu', ratio: '1:1', note: 'Beyaz peynir yerine, ufalanmış' },
    { name: 'Besin mayası', ratio: '100g → 30g', note: 'Parmesan aroması için' },
  ],
  'beyaz peynir': [
    { name: 'Tofu', ratio: '1:1', note: 'Ufalanmış, tuzlu' },
    { name: 'Lor peyniri', ratio: '1:1' },
    { name: 'Ricotta', ratio: '1:1' },
  ],
  'kaşar': [
    { name: 'Cheddar', ratio: '1:1' },
    { name: 'Gouda', ratio: '1:1' },
    { name: 'Mozzarella', ratio: '1:1', note: 'Daha hafif' },
  ],

  // Eggs
  'yumurta': [
    { name: 'Keten tohumu jeli', ratio: '1 yumurta → 1 yk keten + 3 yk su', note: '15 dk bekletin' },
    { name: 'Chia jeli', ratio: '1 yumurta → 1 yk chia + 3 yk su', note: '15 dk bekletin' },
    { name: 'Muz', ratio: '1 yumurta → ½ olgun muz', note: 'Tatlılarda ideal' },
    { name: 'Elma püresi', ratio: '1 yumurta → 60ml', note: 'Kek ve muffin için' },
  ],

  // Flour
  'un': [
    { name: 'Glutensiz un karışımı', ratio: '1:1' },
    { name: 'Badem unu', ratio: '1:1', note: 'Daha yoğun, glutensiz' },
    { name: 'Pirinç unu', ratio: '1:1', note: 'Hafif doku' },
    { name: 'Tam buğday unu', ratio: '1:1', note: 'Daha lifli' },
  ],

  // Sugar
  'şeker': [
    { name: 'Bal', ratio: '100g → 75ml', note: 'Sıvıyı azaltın' },
    { name: 'Akçaağaç şurubu', ratio: '100g → 75ml' },
    { name: 'Hindistancevizi şekeri', ratio: '1:1', note: 'Düşük glisemik' },
    { name: 'Hurma şurubu', ratio: '100g → 80ml' },
  ],
  'pudra şekeri': [
    { name: 'Blenderda çekilmiş toz şeker', ratio: '1:1' },
    { name: 'Hindistancevizi şekeri (ince)', ratio: '1:1' },
  ],

  // Oils
  'zeytinyağı': [
    { name: 'Ayçiçek yağı', ratio: '1:1', note: 'Nötr lezzet' },
    { name: 'Avokado yağı', ratio: '1:1', note: 'Yüksek ısıya dayanıklı' },
    { name: 'Hindistancevizi yağı', ratio: '1:1' },
  ],
  'ayçiçek yağı': [
    { name: 'Zeytinyağı', ratio: '1:1' },
    { name: 'Mısırözü yağı', ratio: '1:1' },
    { name: 'Kanola yağı', ratio: '1:1' },
  ],

  // Protein
  'kıyma': [
    { name: 'Mercimek', ratio: '1:1', note: 'Vegan, pişmiş kırmızı mercimek' },
    { name: 'Mantar kıyma', ratio: '1:1', note: 'İnce kıyılmış mantar' },
    { name: 'Tofu', ratio: '1:1', note: 'Ufalanmış, baharatlı' },
    { name: 'Tavuk kıyma', ratio: '1:1', note: 'Daha az yağlı' },
  ],
  'tavuk': [
    { name: 'Hindi', ratio: '1:1' },
    { name: 'Tofu', ratio: '1:1', note: 'Preslenmiş, marine edilmiş' },
    { name: 'Nohut', ratio: '1:1', note: 'Bitkisel protein' },
  ],
  'et': [
    { name: 'Mantar', ratio: '1:1', note: 'Kral istiridye mantarı özellikle iyi' },
    { name: 'Jackfruit', ratio: '1:1', note: 'Çekilmiş et dokusu' },
    { name: 'Soya proteini', ratio: '1:1' },
  ],

  // Grains
  'bulgur': [
    { name: 'Kinoa', ratio: '1:1', note: 'Glutensiz alternatif' },
    { name: 'Kuskus', ratio: '1:1' },
    { name: 'Pirinç', ratio: '1:1' },
  ],
  'makarna': [
    { name: 'Glutensiz makarna', ratio: '1:1' },
    { name: 'Kabak şeritleri', ratio: '1:1', note: 'Düşük karbonhidrat' },
    { name: 'Pirinç makarnası', ratio: '1:1' },
  ],
  'pirinç': [
    { name: 'Karnabahar pilavı', ratio: '1:1', note: 'Rendelenmiş karnabahar' },
    { name: 'Kinoa', ratio: '1:1', note: 'Daha fazla protein' },
    { name: 'Bulgur', ratio: '1:1' },
  ],
  'ekmek': [
    { name: 'Glutensiz ekmek', ratio: '1:1' },
    { name: 'Marul yaprağı', ratio: '1:1', note: 'Wrap olarak, düşük karb' },
    { name: 'Pirinç keki', ratio: '1:1' },
  ],

  // Seasonings
  'soğan': [
    { name: 'Arpacık soğan', ratio: '1 soğan → 4-5 arpacık' },
    { name: 'Pırasa', ratio: '1:1', note: 'Daha hafif lezzet' },
    { name: 'Soğan tozu', ratio: '1 soğan → 1 çk toz' },
  ],
  'sarımsak': [
    { name: 'Sarımsak tozu', ratio: '1 diş → ¼ çk toz' },
    { name: 'Sarımsak granülü', ratio: '1 diş → ½ çk' },
    { name: 'Arpacık soğan', ratio: '1 diş → 1 arpacık', note: 'Hafif aroma' },
  ],
  'limon suyu': [
    { name: 'Sirke', ratio: '1:1', note: 'Elma sirkesi en yakın' },
    { name: 'Narenciye suyu (portakal/greyfurt)', ratio: '1:1' },
    { name: 'Sitrik asit', ratio: '1 yk → ½ çk kristal + su' },
  ],
  'soya sosu': [
    { name: 'Tamari', ratio: '1:1', note: 'Glutensiz' },
    { name: 'Hindistancevizi amino', ratio: '1:1', note: 'Daha hafif' },
    { name: 'Worcestershire sos', ratio: '1:½', note: 'Daha yoğun' },
  ],
};

export function findSubstitutions(ingredientName: string): Substitution[] | null {
  const lower = ingredientName.toLowerCase().trim();

  // Direct match
  if (substitutionMap[lower]) return substitutionMap[lower];

  // Partial match — check if ingredient name contains a known key
  for (const [key, subs] of Object.entries(substitutionMap)) {
    if (lower.includes(key) || key.includes(lower)) {
      return subs;
    }
  }

  return null;
}
