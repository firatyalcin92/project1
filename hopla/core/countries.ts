/**
 * ISO 3166-1 alpha-2 ülke kodları. Adlar cihazın dilinde Intl.DisplayNames ile gösterilir;
 * böylece istemciye ülke adı verisi gömülmez. Sunucu da yalnızca bu kodları kabul eder.
 */
const CODES =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO ' +
  'FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE ' +
  'JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO ' +
  'MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW ' +
  'PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM ' +
  'TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW'

export const COUNTRY_CODES: readonly string[] = CODES.split(' ')

const SET = new Set(COUNTRY_CODES)

export function isCountryCode(code: unknown): code is string {
  return typeof code === 'string' && SET.has(code)
}

/** 🇹🇷 gibi bayrak emojisi (bölgesel gösterge harfleri). */
export function flagEmoji(code: string) {
  if (!isCountryCode(code)) return '🏳️'
  return String.fromCodePoint(...[...code].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

/** Dil → en olası ülke (cihaz dili bölge içermiyorsa) */
const LANGUAGE_COUNTRY: Record<string, string> = {
  tr: 'TR',
  en: 'US',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  pt: 'BR',
  it: 'IT',
  nl: 'NL',
  ru: 'RU',
  uk: 'UA',
  pl: 'PL',
  ja: 'JP',
  ko: 'KR',
  zh: 'CN',
  ar: 'SA',
  fa: 'IR',
  he: 'IL',
  hi: 'IN',
  id: 'ID',
  ms: 'MY',
  th: 'TH',
  vi: 'VN',
  sv: 'SE',
  no: 'NO',
  nb: 'NO',
  da: 'DK',
  fi: 'FI',
  el: 'GR',
  cs: 'CZ',
  sk: 'SK',
  hu: 'HU',
  ro: 'RO',
  bg: 'BG',
  sr: 'RS',
  hr: 'HR',
  bs: 'BA',
  sl: 'SI',
  az: 'AZ',
  kk: 'KZ',
  uz: 'UZ',
  ka: 'GE',
  hy: 'AM',
  sq: 'AL',
  mk: 'MK',
  lt: 'LT',
  lv: 'LV',
  et: 'EE',
  bn: 'BD',
  ur: 'PK',
  fil: 'PH',
  tl: 'PH',
  sw: 'KE',
  af: 'ZA',
}

/** Saat dilimi → ülke (dil bölge bilgisi vermezse yedek) */
const ZONE_COUNTRY: Record<string, string> = {
  'Europe/Istanbul': 'TR',
  'Asia/Istanbul': 'TR',
  'Europe/Berlin': 'DE',
  'Europe/London': 'GB',
  'Europe/Paris': 'FR',
  'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Zurich': 'CH',
  'Europe/Stockholm': 'SE',
  'Europe/Oslo': 'NO',
  'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI',
  'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ',
  'Europe/Budapest': 'HU',
  'Europe/Bucharest': 'RO',
  'Europe/Sofia': 'BG',
  'Europe/Athens': 'GR',
  'Europe/Kiev': 'UA',
  'Europe/Kyiv': 'UA',
  'Europe/Moscow': 'RU',
  'Europe/Lisbon': 'PT',
  'Europe/Dublin': 'IE',
  'Asia/Baku': 'AZ',
  'Asia/Tbilisi': 'GE',
  'Asia/Dubai': 'AE',
  'Asia/Riyadh': 'SA',
  'Asia/Tehran': 'IR',
  'Asia/Karachi': 'PK',
  'Asia/Kolkata': 'IN',
  'Asia/Calcutta': 'IN',
  'Asia/Dhaka': 'BD',
  'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID',
  'Asia/Singapore': 'SG',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Manila': 'PH',
  'Asia/Shanghai': 'CN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Taipei': 'TW',
  'Asia/Seoul': 'KR',
  'Asia/Tokyo': 'JP',
  'Asia/Almaty': 'KZ',
  'Asia/Tashkent': 'UZ',
  'Africa/Cairo': 'EG',
  'Africa/Lagos': 'NG',
  'Africa/Johannesburg': 'ZA',
  'Africa/Nairobi': 'KE',
  'Africa/Casablanca': 'MA',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Phoenix': 'US',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Mexico_City': 'MX',
  'America/Sao_Paulo': 'BR',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Bogota': 'CO',
  'America/Lima': 'PE',
  'America/Santiago': 'CL',
  'Australia/Sydney': 'AU',
  'Australia/Melbourne': 'AU',
  'Pacific/Auckland': 'NZ',
}

/** Cihaz diline ve saat dilimine bakarak ülke tahmini; kullanıcı her zaman değiştirebilir. */
export function guessCountry(languages: readonly string[], timeZone?: string): string {
  for (const tag of languages) {
    const region = tag.split(/[-_]/).find((part, i) => i > 0 && /^[A-Za-z]{2}$/.test(part))
    if (region && isCountryCode(region.toUpperCase())) return region.toUpperCase()
  }
  if (timeZone && ZONE_COUNTRY[timeZone]) return ZONE_COUNTRY[timeZone]!
  for (const tag of languages) {
    const lang = tag.split(/[-_]/)[0]?.toLowerCase() ?? ''
    if (LANGUAGE_COUNTRY[lang]) return LANGUAGE_COUNTRY[lang]!
  }
  return 'US'
}
