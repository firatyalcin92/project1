/** Arayüz metinleri. Cihaz dili Türkçe ise Türkçe, değilse İngilizce. */

const en = {
  tagline: 'Hold. Release. Hop.',
  hint: 'Press and hold anywhere',
  best: 'Best',
  newBest: 'New best!',
  score: 'Score',
  playAgain: 'Play again',
  home: 'Main menu',
  leaderboard: 'Leaderboard',
  world: 'World',
  countries: 'Countries',
  you: 'You',
  chooseName: 'Choose a name',
  joinPrompt: 'Pick a name to join the leaderboard',
  nameTitle: 'Your name on the leaderboard',
  nameHint: '3–16 letters or digits, no spaces or symbols. Your name cannot be changed later.',
  namePlaceholder: 'Name',
  country: 'Country',
  save: 'Save',
  notNow: 'Not now',
  edit: 'Edit',
  saving: 'Saving…',
  waking: 'Waking up the server…',
  loading: 'Loading…',
  empty: 'No scores yet. Be the first!',
  close: 'Close',
  deleteMe: 'Delete my name and scores',
  worldRecord: '🏆 World record!',
  countryRecord: (c: string) => `${c} record!`,
  playsTitle: 'Games over 50 points',
  nameSuggested: (s: string) => `This name is taken. How about ${s}? Tap Save if you like it.`,
  deleteConfirm: 'Tap again to delete permanently',
  deleted: 'Your name and scores were deleted',
  report: 'Report name',
  reported: 'Reported — thank you',
  privacy: 'Privacy & support',
  soundOn: 'Sound on',
  soundOff: 'Sound off',
  players: (n: number) => `${n.toLocaleString()} ${n === 1 ? 'player' : 'players'}`,
  rankWorld: (n: number) => `World #${n.toLocaleString()}`,
  offlineRun: 'Played offline — not ranked',
  notSent: 'Score saved; it will be sent when you are online',
  memoryStore: 'Test mode: the leaderboard resets when the server restarts',
  errors: {
    NAME_LENGTH: 'Use 3–16 characters.',
    NAME_CHARS: 'Use only letters and digits (at least 2 letters, no spaces or symbols).',
    NAME_LOCKED: 'Names cannot be changed. Delete your name to pick a new one.',
    NAME_BLOCKED: 'This name is not allowed. Please choose another one.',
    NAME_TAKEN: 'This name is already taken.',
    COUNTRY: 'Choose a country.',
    RATE_LIMITED: 'Too many attempts. Please try again later.',
    RENAME_LIMIT: 'You can change your name again tomorrow.',
    SETUP_REQUIRED: 'The leaderboard is not set up yet.',
    OUTDATED: 'Please update the game.',
    NETWORK: 'Can’t reach the server. The game keeps working offline.',
    GENERIC: 'Something went wrong. Please try again.',
  },
}

type Strings = typeof en

const tr: Strings = {
  tagline: 'Basılı tut. Bırak. Zıpla.',
  hint: 'Ekrana basılı tut',
  best: 'En iyi',
  newBest: 'Yeni rekor!',
  score: 'Skor',
  playAgain: 'Tekrar oyna',
  home: 'Ana menü',
  leaderboard: 'Sıralama',
  world: 'Dünya',
  countries: 'Ülkeler',
  you: 'Sen',
  chooseName: 'İsim seç',
  joinPrompt: 'Sıralamaya girmek için isim seç',
  nameTitle: 'Sıralamada görünecek ismin',
  nameHint: '3–16 harf ya da rakam; boşluk ve simge olmaz. İsim sonradan değiştirilemez.',
  namePlaceholder: 'İsim',
  country: 'Ülke',
  save: 'Kaydet',
  notNow: 'Şimdi değil',
  edit: 'Düzenle',
  saving: 'Kaydediliyor…',
  waking: 'Sunucu uyanıyor…',
  loading: 'Yükleniyor…',
  empty: 'Henüz skor yok. İlk sen ol!',
  close: 'Kapat',
  deleteMe: 'İsmimi ve skorlarımı sil',
  worldRecord: '🏆 Dünya rekoru!',
  countryRecord: (c: string) => `${c} rekoru!`,
  playsTitle: '50 puanı geçen oyun sayısı',
  nameSuggested: (s: string) => `Bu isim alınmış. ${s} nasıl? Beğendiysen Kaydet'e bas.`,
  deleteConfirm: 'Kalıcı olarak silmek için tekrar dokun',
  deleted: 'İsmin ve skorların silindi',
  report: 'İsmi bildir',
  reported: 'Bildirildi, teşekkürler',
  privacy: 'Gizlilik ve destek',
  soundOn: 'Ses açık',
  soundOff: 'Ses kapalı',
  players: (n: number) => `${n.toLocaleString('tr-TR')} oyuncu`,
  rankWorld: (n: number) => `Dünya #${n.toLocaleString('tr-TR')}`,
  offlineRun: 'Çevrimdışı oynandı — sıralamaya girmedi',
  notSent: 'Skor kaydedildi; bağlantı gelince gönderilecek',
  memoryStore: 'Deneme modu: sıralama sunucu yeniden başlayınca sıfırlanır',
  errors: {
    NAME_LENGTH: '3–16 karakter kullan.',
    NAME_CHARS: 'Yalnızca harf ve rakam kullan (en az 2 harf; boşluk ve simge olmaz).',
    NAME_LOCKED: 'İsim değiştirilemez. Yeni isim için önce ismini sil.',
    NAME_BLOCKED: 'Bu isim kullanılamaz. Lütfen başka bir isim seç.',
    NAME_TAKEN: 'Bu isim alınmış.',
    COUNTRY: 'Bir ülke seç.',
    RATE_LIMITED: 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
    RENAME_LIMIT: 'İsmini yarın tekrar değiştirebilirsin.',
    SETUP_REQUIRED: 'Sıralama henüz kurulmadı.',
    OUTDATED: 'Lütfen oyunu güncelle.',
    NETWORK: 'Sunucuya ulaşılamadı. Oyun çevrimdışı çalışmaya devam eder.',
    GENERIC: 'Bir şeyler ters gitti. Lütfen tekrar dene.',
  },
}

const langs = typeof navigator !== 'undefined' ? (navigator.languages ?? [navigator.language]) : ['en']
export const LANG = langs.some((l) => l?.toLowerCase().startsWith('tr')) ? 'tr' : 'en'
export const t: Strings = LANG === 'tr' ? tr : en

export type ErrorKey = keyof Strings['errors']

export function errorText(code: string | undefined): string {
  const map = t.errors as Record<string, string>
  return (code && map[code]) || t.errors.GENERIC
}

/** Ülke adı cihaz dilinde (Intl.DisplayNames yoksa kod) */
let names: Intl.DisplayNames | null = null
export function countryName(code: string) {
  try {
    names ??= new Intl.DisplayNames([LANG], { type: 'region' })
    return names.of(code) ?? code
  } catch {
    return code
  }
}
