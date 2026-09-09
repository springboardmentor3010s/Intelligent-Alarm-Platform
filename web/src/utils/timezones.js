/**
 * Full IANA timezone catalog for the web app.
 *
 * Prefers `Intl.supportedValuesOf('timeZone')` (~400 zones) and falls back to a
 * curated list on runtimes that don't expose it. Every option is labelled with
 * its current GMT offset so a user can pick correctly, and sorted by offset so
 * geographically-related zones group together.
 */

export const FALLBACK_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

/**
 * Country → zone aliases so the picker's search matches plain country names
 * (e.g. typing "India" returns Asia/Kolkata, "USA" returns the US zones).
 * Keys are lowercase; region names come from the zone's own path segment too.
 */
const COUNTRY_ZONES = {
  india: ['Asia/Kolkata', 'Asia/Calcutta'],
  pakistan: ['Asia/Karachi'],
  bangladesh: ['Asia/Dhaka'],
  'sri lanka': ['Asia/Colombo'],
  nepal: ['Asia/Kathmandu'],
  china: ['Asia/Shanghai', 'Asia/Hong_Kong', 'Asia/Urumqi', 'Asia/Macau'],
  'hong kong': ['Asia/Hong_Kong'],
  japan: ['Asia/Tokyo'],
  'south korea': ['Asia/Seoul'],
  korea: ['Asia/Seoul', 'Asia/Pyongyang'],
  taiwan: ['Asia/Taipei'],
  singapore: ['Asia/Singapore'],
  malaysia: ['Asia/Kuala_Lumpur', 'Asia/Kuching'],
  indonesia: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Pontianak', 'Asia/Jayapura'],
  philippines: ['Asia/Manila'],
  thailand: ['Asia/Bangkok'],
  vietnam: ['Asia/Ho_Chi_Minh'],
  cambodia: ['Asia/Phnom_Penh'],
  myanmar: ['Asia/Yangon'],
  mongolia: ['Asia/Ulaanbaatar'],
  'uae': ['Asia/Dubai'],
  dubai: ['Asia/Dubai'],
  'saudi arabia': ['Asia/Riyadh'],
  iran: ['Asia/Tehran'],
  iraq: ['Asia/Baghdad'],
  israel: ['Asia/Jerusalem'],
  'united kingdom': ['Europe/London'],
  uk: ['Europe/London'],
  britain: ['Europe/London'],
  england: ['Europe/London'],
  france: ['Europe/Paris'],
  germany: ['Europe/Berlin'],
  italy: ['Europe/Rome'],
  spain: ['Europe/Madrid'],
  portugal: ['Europe/Lisbon'],
  netherlands: ['Europe/Amsterdam'],
  holland: ['Europe/Amsterdam'],
  belgium: ['Europe/Brussels'],
  switzerland: ['Europe/Zurich'],
  austria: ['Europe/Vienna'],
  sweden: ['Europe/Stockholm'],
  norway: ['Europe/Oslo'],
  denmark: ['Europe/Copenhagen'],
  finland: ['Europe/Helsinki'],
  ireland: ['Europe/Dublin'],
  iceland: ['Atlantic/Reykjavik'],
  greece: ['Europe/Athens'],
  poland: ['Europe/Warsaw'],
  'czech republic': ['Europe/Prague'],
  hungary: ['Europe/Budapest'],
  romania: ['Europe/Bucharest'],
  ukraine: ['Europe/Kyiv', 'Europe/Kiev'],
  'russia': ['Europe/Moscow'],
  turkey: ['Europe/Istanbul'],
  egypt: ['Africa/Cairo'],
  morocco: ['Africa/Casablanca'],
  nigeria: ['Africa/Lagos'],
  kenya: ['Africa/Nairobi'],
  'south africa': ['Africa/Johannesburg'],
  ethiopia: ['Africa/Addis_Ababa'],
  australia: [
    'Australia/Sydney',
    'Australia/Melbourne',
    'Australia/Brisbane',
    'Australia/Perth',
    'Australia/Adelaide',
    'Australia/Darwin',
    'Australia/Hobart',
    'Australia/Eucla',
  ],
  'new zealand': ['Pacific/Auckland', 'Pacific/Chatham'],
  fiji: ['Pacific/Fiji'],
  hawaii: ['Pacific/Honolulu'],
  alaska: ['America/Anchorage', 'America/Juneau', 'America/Nome', 'America/Sitka', 'America/Yakutat', 'America/Adak'],
};

const US_ZONES = [
  'America/New_York',
  'America/Detroit',
  'America/Indiana/Knox',
  'America/Indiana/Petersburg',
  'America/Indiana/Tell_City',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Indianapolis',
  'America/Chicago',
  'America/Denver',
  'America/Boise',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'America/Juneau',
  'America/Sitka',
  'America/Yakutat',
  'America/Nome',
  'America/Adak',
  'Pacific/Honolulu',
];

const CANADA_ZONES = [
  'America/St_Johns',
  'America/Goose_Bay',
  'America/Toronto',
  'America/Nipigon',
  'America/Thunder_Bay',
  'America/Winnipeg',
  'America/Rainy_River',
  'America/Regina',
  'America/Swift_Current',
  'America/Edmonton',
  'America/Cambridge_Bay',
  'America/Inuvik',
  'America/Yellowknife',
  'America/Dawson_Creek',
  'America/Fort_Nelson',
  'America/Vancouver',
  'America/Whitehorse',
  'America/Dawson',
];

/** Search keywords for a zone: region, explicit country aliases, and the zone itself. */
export function timeZoneTags(zone) {
  const lower = zone.toLowerCase();
  const region = lower.split('/')[0] || lower;
  const tags = new Set([region, lower, lower.replaceAll('/', ' ')]);

  if (US_ZONES.includes(zone)) {
    tags.add('us');
    tags.add('usa');
    tags.add('america');
    tags.add('united states');
  }
  if (CANADA_ZONES.includes(zone)) tags.add('canada');

  for (const [country, zones] of Object.entries(COUNTRY_ZONES)) {
    if (zones.includes(zone)) tags.add(country);
  }

  return [...tags];
}

export function allTimeZones() {
  if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
    try {
      const zones = Intl.supportedValuesOf('timeZone');
      if (Array.isArray(zones) && zones.length) {
        // Some ICU builds omit UTC and use legacy names (e.g., Asia/Calcutta instead of Asia/Kolkata)
        const guaranteed = ['UTC', 'Asia/Kolkata'];
        const extra = guaranteed.filter(g => !zones.includes(g));
        return [...extra, ...zones];
      }
    } catch {
      /* older runtime without the API */
    }
  }
  return FALLBACK_TIMEZONES;
}

/** GMT offset label for a zone at a given instant, e.g. "GMT+05:30". */
export function zoneOffsetLabel(zone, at = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'longOffset',
    }).formatToParts(at);
    const tz = parts.find(p => p.type === 'timeZoneName');
    return (tz && tz.value) || '';
  } catch {
    return '';
  }
}

/** Numeric offset in minutes so options sort by actual GMT offset. */
export function zoneOffsetMinutes(zone, at = new Date()) {
  const m = String(zoneOffsetLabel(zone, at)).match(/[+-]\d{2}:\d{2}/);
  if (!m) return 0;
  const sign = m[0][0] === '-' ? -1 : 1;
  const [h, min] = m[0].slice(1).split(':').map(Number);
  return sign * (h * 60 + min);
}

export function buildTimeZoneOptions() {
  return allTimeZones()
    .map(zone => ({
      value: zone,
      label: `${zone} (${zoneOffsetLabel(zone)})`,
      offset: zoneOffsetMinutes(zone),
      tags: timeZoneTags(zone),
    }))
    .sort((a, b) => a.offset - b.offset || a.value.localeCompare(b.value));
}