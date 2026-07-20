interface GeoLocation {
  locationCode: number;
  languageCode: string;
  country: string;
}

const TLD_MAP: Record<string, GeoLocation> = {
  "in":    { locationCode: 1007810, languageCode: "en", country: "India" },
  "co.in": { locationCode: 1007810, languageCode: "en", country: "India" },
  "uk":    { locationCode: 2826, languageCode: "en", country: "United Kingdom" },
  "co.uk": { locationCode: 2826, languageCode: "en", country: "United Kingdom" },
  "de":    { locationCode: 2276, languageCode: "de", country: "Germany" },
  "fr":    { locationCode: 2250, languageCode: "fr", country: "France" },
  "au":    { locationCode: 2036, languageCode: "en", country: "Australia" },
  "com.au":{ locationCode: 2036, languageCode: "en", country: "Australia" },
  "ca":    { locationCode: 2124, languageCode: "en", country: "Canada" },
  "jp":    { locationCode: 2392, languageCode: "ja", country: "Japan" },
  "br":    { locationCode: 2076, languageCode: "pt", country: "Brazil" },
  "sg":    { locationCode: 2702, languageCode: "en", country: "Singapore" },
  "za":    { locationCode: 2710, languageCode: "en", country: "South Africa" },
  "ae":    { locationCode: 2784, languageCode: "ar", country: "UAE" },
  "sa":    { locationCode: 2682, languageCode: "ar", country: "Saudi Arabia" },
  "nl":    { locationCode: 2528, languageCode: "nl", country: "Netherlands" },
  "es":    { locationCode: 2724, languageCode: "es", country: "Spain" },
  "it":    { locationCode: 2380, languageCode: "it", country: "Italy" },
  "pt":    { locationCode: 2620, languageCode: "pt", country: "Portugal" },
  "pl":    { locationCode: 2616, languageCode: "pl", country: "Poland" },
  "se":    { locationCode: 2752, languageCode: "sv", country: "Sweden" },
  "no":    { locationCode: 2578, languageCode: "no", country: "Norway" },
  "dk":    { locationCode: 2208, languageCode: "da", country: "Denmark" },
  "fi":    { locationCode: 2246, languageCode: "fi", country: "Finland" },
  "nz":    { locationCode: 2554, languageCode: "en", country: "New Zealand" },
  "mx":    { locationCode: 2484, languageCode: "es", country: "Mexico" },
  "ar":    { locationCode: 2032, languageCode: "es", country: "Argentina" },
  "cl":    { locationCode: 2152, languageCode: "es", country: "Chile" },
  "co":    { locationCode: 2170, languageCode: "es", country: "Colombia" },
  "ph":    { locationCode: 2608, languageCode: "en", country: "Philippines" },
  "id":    { locationCode: 2360, languageCode: "id", country: "Indonesia" },
  "my":    { locationCode: 2458, languageCode: "ms", country: "Malaysia" },
  "th":    { locationCode: 2764, languageCode: "th", country: "Thailand" },
  "vn":    { locationCode: 2704, languageCode: "vi", country: "Vietnam" },
  "kr":    { locationCode: 2410, languageCode: "ko", country: "South Korea" },
  "tw":    { locationCode: 158,  languageCode: "zh", country: "Taiwan" },
  "hk":    { locationCode: 2344, languageCode: "zh", country: "Hong Kong" },
  "ie":    { locationCode: 2372, languageCode: "en", country: "Ireland" },
};

const DEFAULT_LOCATION: GeoLocation = {
 locationCode: 1007810,
 languageCode: "en",
 country: "India",
};

/**
 * Detects the DataForSEO location code and language from a domain's TLD.
 * Example: "optm.in" → { locationCode: 1007810, languageCode: "en", country: "India" }
 * Generic TLDs (.com, .org, .net) default to India.
 */
export function detectLocationFromDomain(domain: string): GeoLocation {
  const hostname = domain.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  const parts = hostname.split(".");

  if (parts.length < 2) return DEFAULT_LOCATION;

  const tld = parts[parts.length - 1];

  for (let i = parts.length - 1; i >= 1; i--) {
    const candidate = parts.slice(i).join(".");
    if (TLD_MAP[candidate]) {
      return TLD_MAP[candidate];
    }
  }

  if (TLD_MAP[tld]) {
    return TLD_MAP[tld];
  }

  return DEFAULT_LOCATION;
}

export const DEFAULT_LOCATION_CODE = DEFAULT_LOCATION.locationCode;
export const DEFAULT_LANGUAGE_CODE = DEFAULT_LOCATION.languageCode;
