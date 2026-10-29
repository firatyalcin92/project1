import { describe, expect, it } from 'vitest'
import { checkNameShape, cleanName } from '../hopla/core/api'
import { moderateWithAI, nameKey, screenName } from '~/server/hopla/names.server'

const blocked = (n: string) => !screenName(n).ok

describe('hopla isim biçimi', () => {
  it('uzunluk ve karakter kuralları', () => {
    expect(checkNameShape('Ali')).toBe('ok')
    expect(checkNameShape('IşıkYılmaz')).toBe('ok')
    expect(checkNameShape('Ali2026')).toBe('ok')
    expect(checkNameShape('小明小明')).toBe('ok')
    expect(checkNameShape('Сергей')).toBe('ok')
    // boşluk ve simge yok: kelimeyi bölüp filtreden kaçırmak engellenir
    expect(checkNameShape('player_one')).toBe('NAME_CHARS')
    expect(checkNameShape('Işık Yılmaz')).toBe('NAME_CHARS')
    expect(checkNameShape('ali-veli')).toBe('NAME_CHARS')
    expect(checkNameShape('ali.veli')).toBe('NAME_CHARS')
    expect(checkNameShape('ali@veli')).toBe('NAME_CHARS')
    expect(checkNameShape('12345678')).toBe('NAME_CHARS')
    expect(checkNameShape('a1234567')).toBe('NAME_CHARS')
    expect(checkNameShape('ab')).toBe('NAME_LENGTH')
    expect(checkNameShape('a'.repeat(17))).toBe('NAME_LENGTH')
    expect(checkNameShape('ali😀')).toBe('NAME_CHARS')
    expect(checkNameShape('<b>ali</b>')).toBe('NAME_CHARS')
    expect(checkNameShape('_ali')).toBe('NAME_CHARS')
    expect(checkNameShape('a..li')).toBe('NAME_CHARS')
    expect(checkNameShape('1234')).toBe('NAME_CHARS')
  })

  it('görünmez karakterleri ve fazla boşlukları temizler', () => {
    expect(cleanName('  Ali​   Veli ‮')).toBe('Ali Veli')
  })
})

describe('hopla benzersizlik anahtarı', () => {
  it('büyük/küçük harf, aksan, ayraç ve benzer harfler aynı sayılır', () => {
    const k = nameKey('Ali Veli')
    for (const v of ['ALİ VELİ', 'ali.veli', 'Alí_Velí', 'АLI VELI' /* Kiril А */, 'ａｌｉｖｅｌｉ', 'ali-veli']) {
      expect(nameKey(v)).toBe(k)
    }
    expect(nameKey('Işık')).toBe(nameKey('isik'))
    expect(nameKey('Ali1')).not.toBe(nameKey('Ali2'))
  })
})

describe('hopla isim denetimi: engellenenler', () => {
  const cases = [
    // İngilizce küfür ve gizleme denemeleri
    'fuck',
    'F.u.c.k',
    'fuuuuck',
    'FuCk you',
    'phuck it',
    'fck123',
    'MotherFucker',
    'f u c k',
    'fuk u',
    'shit',
    'bull shit',
    'Dickhead',
    'cunt',
    'asshole',
    'a55hole',
    'big dick',
    'Sexy Girl',
    'bitch',
    // Kötü şöhretli kişiler, nefret, terör
    'Hitler',
    'H1tl3r',
    'ʜɪᴛʟᴇʀ',
    'Ｈｉｔｌｅｒ',
    'Аdolf Нitler',
    'Adolf_Hitler',
    'HeilHitler',
    'nazi',
    'Nazi88',
    'neo nazi',
    '1488',
    'Ali 14 88',
    'Mussolini',
    'Stalin',
    'Osama bin Laden',
    'BinLaden',
    'ISIS',
    'PKK',
    'Taliban',
    'kukluxklan',
    'KKK',
    'White Power',
    'nigger',
    'n1gga',
    'faggot',
    '卐',
    'ᛋᛋ Ali',
    // Türkçe
    'orospu çocuğu',
    'OROSPU',
    'amk',
    'Aq',
    'siktir',
    'SİKTİR',
    'SIKTIR',
    'sikerim',
    'Ananı',
    'piç',
    'yarrak',
    'şerefsiz',
    'Gerizekalı',
    'amcık',
    'amınakoyim',
    'göt veren',
    'pezevenk',
    'kahpe',
    'ibne',
    'Vatan Haini',
    'Terörist',
    'Kahrolsun Herkes',
    // Diğer diller
    'puta',
    'Hijo de puta',
    'mierda',
    'cabrón',
    'caralho',
    'putain',
    'salope',
    'Arschloch',
    'Hurensohn',
    'Scheiße',
    'cazzo',
    'vaffanculo',
    'kurwa',
    'blyat',
    'сука',
    'хуй',
    'пиздец',
    '傻逼',
    '操你妈',
    'ちんこ',
    '씨발',
    'شرموطة',
    'chutiya',
    'madarchod',
    'kontol',
    'putangina',
    'vittu',
    'malakas',
    // Siyasi hakaret
    'Erdoğan Hain',
    'ErdoganKatil',
    'Putin it',
    'Trump Sucks',
    'Kılıçdaroğlu Yalancı',
    'Atatürk Düşmanı',
    'RTE diktatör',
    'Biden Idiot',
    // Ayrılmış isimler
    'admin',
    'Adm1n',
    'Hopla',
    'HOPLA',
    'Moderator',
    'official',
  ]
  for (const n of cases) {
    it(`engeller: ${n}`, () => expect(blocked(n)).toBe(true))
  }
})

describe('hopla isim denetimi: masum isimler geçer', () => {
  const names = [
    // Türkçe
    'Ahmet',
    'Mehmet',
    'Mustafa',
    'Ayşe',
    'Fatma',
    'Zeynep',
    'Elif',
    'Ali',
    'Hüseyin',
    'İbrahim',
    'Ömer',
    'Kemal',
    'Mustafa Kemal',
    'Atatürk',
    'Recep',
    'Erdoğan Yılmaz',
    'Cumhur',
    'Işık',
    'Işıl',
    'Nazım',
    'Nazif',
    'Nazlı',
    'Sıla',
    'Burak',
    'Emre',
    'Deniz',
    'Gökhan',
    'Oğuz',
    'Yiğit',
    'Doğan',
    'Şükrü',
    'Çağla',
    'Ümit',
    'Öykü',
    'Fırat Yalçın',
    'Kutay',
    'Kutlu',
    'Amcazade',
    'Sıkıcı Kedi',
    'Kuş',
    'Mavi',
    'Kar Tanesi',
    'Kır Atı',
    'Sikke',
    'Esad',
    'Yavaş Kaplumbağa',
    'Babacan',
    'Mal Bulan',
    'Ölümsüz',
    // İngilizce
    'James',
    'Michael',
    'Elizabeth',
    'Jessica',
    'Randi',
    'Cassandra',
    'Cassidy',
    'Bassett',
    'Hancock',
    'Babcock',
    'Woodcock',
    'Peacock',
    'Dickens',
    'Dickinson',
    'Titus',
    'Cumberbatch',
    'Sexton',
    'Analise',
    'Classic Gamer',
    'Assassin',
    'Grape Juice',
    'The Therapist',
    'Scunthorpe',
    'Arsenal FC',
    'Forgotten Soul',
    'Trumpet Player',
    'I am Groot',
    'Got Milk',
    'Lul Master',
    'Mishit',
    // İspanyolca / Portekizce / Fransızca / Almanca / İtalyanca
    'José',
    'María',
    'Concepción',
    'Assunção',
    'João',
    'Mi Futuro',
    'Reputation',
    'Computadora',
    'Jean-Pierre',
    'Françoise',
    'Connor',
    'Jürgen',
    'Günther',
    'Göte',
    'Peder',
    'Figaro',
    'Curva Sud',
    // Rusça / Arapça / Asya / Afrika
    'Сергей',
    'Ольга',
    'Sergey',
    'Olga',
    'Muhammad',
    'Fatima',
    'Amina',
    'Zainab',
    'Saddam',
    'Osama',
    'Bashar',
    'Assad',
    'محمد',
    'فاطمة',
    'Wei',
    'Hui',
    'Huy',
    'Minh',
    'Nguyen',
    'Sakura',
    'Ashitaka',
    'Kakashi',
    'Shitara',
    'Fukuda',
    'Fukuoka',
    'Matsushita',
    'Kinoshita',
    'Kuma',
    'Ami',
    '小明',
    'さくら',
    '김민준',
    'Kim',
    'Park',
    'Aarav',
    'Priya',
    'Rahul',
    'Kumar',
    'Lund',
    'Ngozi',
    'Kwame',
    'Niger',
    'Nigeria',
    'Paska',
    'Malaya',
    'Kamala',
    'Kamala Harris',
    'Putin',
    'Trump',
    'Ali88',
    'Player One',
    'Hopla Fan',
    'राहुल',
  ]
  for (const n of names) {
    it(`geçer: ${n}`, () => expect(screenName(n)).toEqual({ ok: true }))
  }
})

describe('hopla yapay zekâ moderasyonu (isteğe bağlı)', () => {
  const fakeFetch = (body: unknown, ok = true) =>
    (async () => new Response(JSON.stringify(body), { status: ok ? 200 : 500 })) as unknown as typeof fetch

  it('anahtar yoksa atlanır', async () => {
    expect(await moderateWithAI('test', {})).toBe('skip')
  })

  it('işaretlenen isim engellenir, temiz isim geçer, hata durumunda atlanır', async () => {
    const env = { OPENAI_API_KEY: 'sk-test' }
    expect(await moderateWithAI('x', env, fakeFetch({ results: [{ flagged: true }] }))).toBe('flagged')
    expect(
      await moderateWithAI(
        'x',
        env,
        fakeFetch({ results: [{ flagged: false, category_scores: { harassment: 0.6 } }] }),
      ),
    ).toBe('flagged')
    expect(await moderateWithAI('x', env, fakeFetch({ results: [{ flagged: false, category_scores: {} }] }))).toBe('ok')
    expect(await moderateWithAI('x', env, fakeFetch({}, false))).toBe('skip')
    expect(await moderateWithAI('x', { ...env, HOPLA_NAME_AI: 'off' })).toBe('skip')
  })
})

describe('hopla bitişik kısaltma küfürler', () => {
  it('ismin başında ya da sonunda kısaltma küfür engellenir', () => {
    for (const n of [
      'admininmk',
      'hasanınamk',
      'bekleyinorçlar',
      'AMKadmin',
      'adminaq',
      'Aliamq',
      'stfuNoob',
      'juanptm',
      'joaovsf',
      'pierrentm',
      'Adminsg',
      'Mehmetoç',
      'KYSnow',
      'adminbsdk',
      'hasaninaminakoyim',
    ]) {
      expect(screenName(n).ok, n).toBe(false)
    }
  })

  it('kısaltmaya benzeyen gerçek isimler geçer', () => {
    for (const n of ['Orçun', 'McGregor', 'Amina', 'Samina', 'Hamka', 'Ishaq', 'Razzaq', 'Selcuk', 'Aqil', 'Tamer']) {
      expect(screenName(n).ok, n).toBe(true)
    }
  })
})
