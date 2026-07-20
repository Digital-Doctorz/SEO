/**
 * Single source of truth for the app's target location.
 * All modules import from here — never hardcode city/location codes elsewhere.
 */

export const KOLKATA_CITY = "Kolkata";
export const KOLKATA_STATE = "West Bengal";
export const KOLKATA_COUNTRY = "India";
export const KOLKATA_LOCATION_CODE = 1007810;
export const KOLKATA_LANGUAGE_CODE = "en";

/** DataForSEO location code (alias for convenience) */
export const DEFAULT_LOCATION_CODE = KOLKATA_LOCATION_CODE;
export const DEFAULT_LANGUAGE_CODE = KOLKATA_LANGUAGE_CODE;

export const KOLKATA_NEIGHBORHOODS = [
  "Salt Lake",
  "New Town",
  "Park Street",
  "Ballygunge",
  "Dum Dum",
  "Howrah",
  "Baranagar",
  "Belgharia",
  "Sealdah",
  "Esplanade",
  "Gariahat",
  "Beleghata",
  "Topsia",
  "Maniktala",
  "Shyambazar",
  "Behala",
  "Jadavpur",
  "Garia",
  "Rajarhat",
  "Kamarhati",
];

/** Default keyword modifiers that always get appended to Kolkata-local queries */
export const KOLKATA_KEYWORD_MODIFIERS = [
  "in Kolkata",
  "in West Bengal",
  "near me",
  "near Salt Lake",
  "near New Town",
];

export const APP_LOCATION = {
  city: KOLKATA_CITY,
  state: KOLKATA_STATE,
  country: KOLKATA_COUNTRY,
  locationCode: KOLKATA_LOCATION_CODE,
  languageCode: KOLKATA_LANGUAGE_CODE,
  neighborhoods: KOLKATA_NEIGHBORHOODS,
  keywordModifiers: KOLKATA_KEYWORD_MODIFIERS,
} as const;
