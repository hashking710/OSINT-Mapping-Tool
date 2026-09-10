export const RAPID_API_PROVIDER_LIBRARY = {
  peopleDataLabs: {
    id: 'peopleDataLabs',
    name: 'People Data Labs',
    category: 'identity',
    description: 'Identity resolution and person profile enrichment based on names, emails, and professional signals.',
    apiType: 'rapidapi',
    endpointHint: 'people-data-labs.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['people', 'email', 'social', 'identity'],
  },
  clearbit: {
    id: 'clearbit',
    name: 'Clearbit Person / Company',
    category: 'identity',
    description: 'Email and company enrichment for corporate and professional OSINT.',
    apiType: 'rapidapi',
    endpointHint: 'clearbit.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['email', 'company', 'identity'],
  },
  securityTrails: {
    id: 'securityTrails',
    name: 'SecurityTrails',
    category: 'infrastructure',
    description: 'DNS, domain ownership, and subdomain intelligence for target infrastructure.',
    apiType: 'rapidapi',
    endpointHint: 'securitytrails.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['domain', 'dns', 'infrastructure'],
  },
  ipApi: {
    id: 'ipApi',
    name: 'IP Geolocation',
    category: 'location',
    description: 'IP enrichment for geolocation, ASN, ISP, and routing context.',
    apiType: 'rapidapi',
    endpointHint: 'ip-geolocation-api.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['ip', 'geo', 'network'],
  },
  abuseIpDb: {
    id: 'abuseIpDb',
    name: 'AbuseIPDB',
    category: 'risk',
    description: 'Abuse and reputation context for IP addresses and suspicious infrastructure.',
    apiType: 'rapidapi',
    endpointHint: 'abuseipdb.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['ip', 'risk', 'reputation'],
  },
  geoapify: {
    id: 'geoapify',
    name: 'Geoapify',
    category: 'location',
    description: 'Geocoding, reverse geocoding, and POI enrichment with richer local context.',
    apiType: 'rapidapi',
    endpointHint: 'geoapify.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['geo', 'poi', 'place'],
  },
  hunter: {
    id: 'hunter',
    name: 'Hunter.io',
    category: 'contact',
    description: 'Email discovery and verification for company and personal contact investigation.',
    apiType: 'rapidapi',
    endpointHint: 'hunter.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['email', 'contact'],
  },
  numverify: {
    id: 'numverify',
    name: 'Numverify',
    category: 'contact',
    description: 'Phone number validation, lookup, and region metadata.',
    apiType: 'rapidapi',
    endpointHint: 'number-verification.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['phone', 'contact'],
  },
  shodan: {
    id: 'shodan',
    name: 'Shodan',
    category: 'infrastructure',
    description: 'Internet-connected device and service discovery for exposed infrastructure.',
    apiType: 'rapidapi',
    endpointHint: 'shodan.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['infrastructure', 'network', 'device'],
  },
  virusTotal: {
    id: 'virusTotal',
    name: 'VirusTotal URL / Domain Intel',
    category: 'risk',
    description: 'Malicious URL and domain reputation checks for suspicious links, infrastructure, or target artifacts.',
    apiType: 'rapidapi',
    endpointHint: 'virustotal.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['risk', 'reputation', 'domain', 'url'],
  },
  socialLookup: {
    id: 'socialLookup',
    name: 'Social Presence Lookup',
    category: 'social',
    description: 'Username / account cross-platform presence checks with lower reliability than identity providers.',
    apiType: 'rapidapi',
    endpointHint: 'social-lookup.p.rapidapi.com',
    requiresApiKey: true,
    tags: ['social', 'username'],
  },
};

export const RAPID_API_PROVIDER_ORDER = Object.keys(RAPID_API_PROVIDER_LIBRARY);

export function getRapidApiProviderConfig(providerId) {
  const provider = RAPID_API_PROVIDER_LIBRARY[providerId];
  return provider ? { ...provider } : null;
}

export function normalizeRapidApiProviderMap(rawProviders = {}) {
  const normalized = {};
  for (const providerId of RAPID_API_PROVIDER_ORDER) {
    const value = rawProviders[providerId] ?? {};
    normalized[providerId] = {
      ...(value && typeof value === 'object' ? value : {}),
      enabled: value?.enabled === true,
    };
  }
  return normalized;
}

export function getEnabledRapidApiProviders(config = {}) {
  const providerMap = normalizeRapidApiProviderMap(
    config?.externalApis?.providers ?? config?.providers ?? {},
  );
  return RAPID_API_PROVIDER_ORDER.filter(
    (providerId) => providerMap[providerId]?.enabled === true,
  );
}

export function getRapidApiConfig(config = {}) {
  const externalApis = config?.externalApis ?? config ?? {};
  const providers = normalizeRapidApiProviderMap(externalApis.providers ?? {});
  return {
    rapidApiKey: typeof externalApis.rapidApiKey === 'string' ? externalApis.rapidApiKey.trim() : '',
    providers,
    enabledProviders: getEnabledRapidApiProviders({ externalApis: { providers } }),
  };
}

export function buildRapidApiHeaders(config = {}, host = '') {
  const rapidApiKey = getRapidApiConfig(config).rapidApiKey;
  return {
    'Content-Type': 'application/json',
    ...(rapidApiKey ? { 'x-rapidapi-key': rapidApiKey } : {}),
    ...(host ? { 'x-rapidapi-host': host } : {}),
  };
}

async function fetchRapidApi({
  host,
  path = '/',
  method = 'GET',
  query = {},
  body = null,
  config = {},
  headers = {},
}) {
  if (!host) {
    throw new Error('A RapidAPI host is required.');
  }

  const url = new URL(path.startsWith('http') ? path : `https://${host}${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    method,
    headers: {
      ...buildRapidApiHeaders(config, host),
      ...headers,
    },
    ...(body !== null && body !== undefined
      ? { body: typeof body === 'string' ? body : JSON.stringify(body) }
      : {}),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`RapidAPI request failed (${response.status}): ${text || 'unknown error'}`);
  }

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function lookupPeopleDataLabs({ apiKey, name, email, phone, company, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.peopleDataLabs.endpointHint,
    path: '/person',
    method: 'GET',
    query: {
      name,
      email,
      phone,
      company,
    },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupClearbit({ apiKey, email, domain, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.clearbit.endpointHint,
    path: '/v2/people/find',
    method: 'GET',
    query: { email, domain },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupSecurityTrails({ apiKey, domain, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.securityTrails.endpointHint,
    path: '/v1/domain',
    method: 'GET',
    query: { domain },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupGeoapify({ apiKey, query, lat, lng, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.geoapify.endpointHint,
    path: '/v1/geocode/search',
    method: 'GET',
    query: {
      text: query,
      lat,
      lon: lng,
    },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupIpGeolocation({ apiKey, ip, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.ipApi.endpointHint,
    path: '/ip',
    method: 'GET',
    query: { ip },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupAbuseIpDb({ apiKey, ip, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.abuseIpDb.endpointHint,
    path: '/check',
    method: 'GET',
    query: { ip },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupHunter({ apiKey, domain, company, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.hunter.endpointHint,
    path: '/v2/domain-search',
    method: 'GET',
    query: { domain, company },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupNumverify({ apiKey, number, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.numverify.endpointHint,
    path: '/v3/validate',
    method: 'GET',
    query: { number },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupShodan({ apiKey, query, ip, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.shodan.endpointHint,
    path: '/shodan/host/search',
    method: 'GET',
    query: { query, ip },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupVirusTotal({ apiKey, url, domain, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.virusTotal.endpointHint,
    path: '/url',
    method: 'GET',
    query: { url, domain },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupSocialPresence({ apiKey, username, platform, config = {} }) {
  return fetchRapidApi({
    host: RAPID_API_PROVIDER_LIBRARY.socialLookup.endpointHint,
    path: '/username',
    method: 'GET',
    query: { username, platform },
    config: { ...config, externalApis: { ...(config.externalApis ?? {}), rapidApiKey: apiKey || config.externalApis?.rapidApiKey || '' } },
  });
}

export async function lookupExternalApi(providerId, rawValue, config = {}, extra = {}) {
  const value = String(rawValue ?? '').trim();
  const gatewayConfig = {
    ...config,
    externalApis: {
      ...(config?.externalApis ?? {}),
      rapidApiKey: config?.rapidApiKey ?? config?.externalApis?.rapidApiKey ?? '',
      providers: config?.providers ?? config?.externalApis?.providers ?? {},
    },
  };

  switch (providerId) {
    case 'peopleDataLabs':
      return lookupPeopleDataLabs({
        name: value,
        email: extra.email || value,
        phone: extra.phone || value,
        company: extra.company,
        config: gatewayConfig,
      });
    case 'clearbit':
      return lookupClearbit({
        email: extra.email || value,
        domain: extra.domain || value,
        config: gatewayConfig,
      });
    case 'securityTrails':
      return lookupSecurityTrails({ domain: extra.domain || value, config: gatewayConfig });
    case 'ipApi':
      return lookupIpGeolocation({ ip: extra.ip || value, config: gatewayConfig });
    case 'abuseIpDb':
      return lookupAbuseIpDb({ ip: extra.ip || value, config: gatewayConfig });
    case 'geoapify':
      return lookupGeoapify({ query: value || extra.query || '', lat: extra.lat, lng: extra.lng, config: gatewayConfig });
    case 'hunter':
      return lookupHunter({ domain: extra.domain || value, company: extra.company, config: gatewayConfig });
    case 'numverify':
      return lookupNumverify({ number: value, config: gatewayConfig });
    case 'shodan':
      return lookupShodan({ query: value || extra.query || '', ip: extra.ip, config: gatewayConfig });
    case 'virusTotal':
      return lookupVirusTotal({ url: value, domain: extra.domain || value, config: gatewayConfig });
    case 'socialLookup':
      return lookupSocialPresence({ username: value, platform: extra.platform, config: gatewayConfig });
    default:
      throw new Error(`Unsupported external provider: ${providerId}`);
  }
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function toSentence(parts) {
  return parts
    .filter((part) => typeof part === 'string' && part.trim())
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' • ');
}

function parseGeoapifySummary(data) {
  const feature = pickFirst(
    data?.features?.[0],
    data?.results?.[0],
    data?.feature,
  );
  const props = feature?.properties ?? data?.properties ?? {};
  const title = pickFirst(
    props?.formatted,
    props?.name,
    data?.formatted,
    data?.name,
    data?.query,
    'Geoapify location',
  );
  const details = [
    props?.street,
    props?.housenumber ? `${props.housenumber} ${props.street || ''}`.trim() : null,
    props?.city,
    props?.state,
    props?.country,
    props?.postcode,
  ];
  const text = toSentence([
    ...details,
    props?.formatted && props?.formatted !== title ? props.formatted : null,
  ]) || 'Location information collected from Geoapify.';

  return { title: String(title), text, sourceUrl: pickFirst(data?.url, props?.url, null) };
}

function parsePeopleDataLabsSummary(data) {
  const title = pickFirst(
    data?.full_name,
    data?.name,
    data?.title,
    data?.fullName,
    'Person record',
  );
  const text = toSentence([
    data?.summary,
    data?.headline,
    data?.company,
    data?.location,
    data?.email,
    data?.phone,
  ]) || 'Person profile enrichment collected from People Data Labs.';

  return { title: String(title), text, sourceUrl: pickFirst(data?.linkedin_url, data?.linkedinUrl, data?.website, data?.url, null) };
}

function parseSecurityTrailsSummary(data) {
  const title = pickFirst(data?.domain, data?.hostname, 'Domain record');
  const subdomains = Array.isArray(data?.subdomains) ? data.subdomains : [];
  const registrar = pickFirst(data?.whois?.registrar, data?.registrar, data?.company);
  const text = toSentence([
    data?.summary,
    data?.description,
    subdomains.length ? `Subdomains: ${subdomains.slice(0, 5).join(', ')}` : null,
    registrar ? `Registrar: ${registrar}` : null,
    data?.whois?.owner ? `Owner: ${data.whois.owner}` : null,
  ]) || 'Domain ownership and infrastructure data collected from SecurityTrails.';

  return { title: String(title), text, sourceUrl: pickFirst(data?.url, data?.website, data?.homepage, null) };
}

function parseIpSummary(data) {
  const title = pickFirst(data?.query, data?.ip, data?.ipAddress, 'IP record');
  const text = toSentence([
    data?.country,
    data?.city,
    data?.regionName,
    data?.org,
    data?.isp,
    data?.timezone,
  ]) || 'IP geolocation and network metadata collected.';

  return { title: String(title), text, sourceUrl: null };
}

function parseAbuseIpSummary(data) {
  const title = pickFirst(data?.ipAddress, data?.ip, 'IP reputation record');
  const text = toSentence([
    data?.country,
    data?.isp,
    data?.domain,
    data?.usageType,
    data?.totalReports ? `Reports: ${data.totalReports}` : null,
    data?.abuseConfidenceScore ? `Abuse confidence: ${data.abuseConfidenceScore}/100` : null,
    data?.lastReportedAt ? `Last reported: ${data.lastReportedAt}` : null,
  ]) || 'Abuse and reputation information collected.';

  return { title: String(title), text, sourceUrl: pickFirst(data?.url, null) };
}

function parseHunterSummary(data) {
  const title = pickFirst(data?.domain, data?.organization?.domain, 'Hunter result');
  const text = toSentence([
    data?.data?.company || data?.company,
    data?.data?.email || data?.email,
    data?.data?.first_name || data?.firstName ? `${data?.data?.first_name || data?.firstName} ${data?.data?.last_name || data?.lastName}`.trim() : null,
    data?.data?.confidence || data?.confidence ? `Confidence: ${data?.data?.confidence || data?.confidence}` : null,
  ]) || 'Email discovery result collected from Hunter.';

  return { title: String(title), text, sourceUrl: pickFirst(data?.url, null) };
}

function parseNumverifySummary(data) {
  const title = pickFirst(data?.number, data?.phone, 'Phone validation result');
  const text = toSentence([
    data?.country_code ? `Country code: ${data.country_code}` : null,
    data?.country_name || data?.country,
    data?.location,
    data?.carrier,
    data?.line_type || data?.lineType,
    data?.valid === false ? 'Number invalid' : data?.valid === true ? 'Number valid' : null,
  ]) || 'Phone validation metadata collected.';

  return { title: String(title), text, sourceUrl: null };
}

function parseShodanSummary(data) {
  const title = pickFirst(data?.ip_str, data?.ip, data?.hostnames?.[0], 'Shodan result');
  const host = data?.data?.[0] ?? data;
  const text = toSentence([
    host?.org,
    host?.country_name || host?.country,
    host?.city,
    host?.hostnames?.length ? `Hosts: ${host.hostnames.join(', ')}` : null,
    Array.isArray(host?.ports) && host.ports.length ? `Ports: ${host.ports.slice(0, 5).join(', ')}` : null,
  ]) || 'Internet-exposed service data collected from Shodan.';

  return { title: String(title), text, sourceUrl: pickFirst(data?.url, null) };
}

function parseVirusTotalSummary(data) {
  const title = pickFirst(data?.domain, data?.url, data?.attributes?.url_info?.url, 'VirusTotal result');
  const summaryText = toSentence([
    data?.summary,
    data?.description,
    data?.attributes?.last_analysis_stats ? `Last analysis: ${JSON.stringify(data.attributes.last_analysis_stats)}` : null,
    data?.attributes?.popular_threat_classification?.suggested_threat_label,
  ]) || 'Threat reputation metadata collected from VirusTotal.';

  return { title: String(title), text: summaryText, sourceUrl: pickFirst(data?.permalink, data?.url, null) };
}

function parseSocialSummary(data) {
  const title = pickFirst(data?.username, data?.handle, data?.platform, 'Social presence result');
  const text = toSentence([
    data?.platform,
    data?.location,
    data?.bio,
    data?.url,
    data?.verified ? 'Verified account' : null,
  ]) || 'Social presence information collected.';

  return { title: String(title), text, sourceUrl: pickFirst(data?.url, data?.profile_url, null) };
}

export function summarizeExternalApiResult(providerId, payload) {
  const provider = getRapidApiProviderConfig(providerId);
  if (!provider) return null;

  const data = payload && typeof payload === 'object' ? payload : {};
  const normalized = (() => {
    switch (providerId) {
      case 'peopleDataLabs':
        return parsePeopleDataLabsSummary(data);
      case 'clearbit':
        return {
          title: String(pickFirst(data?.person?.name, data?.name, data?.email, data?.domain, provider.name)),
          text: toSentence([
            data?.person?.title,
            data?.person?.company,
            data?.company?.name,
            data?.person?.location,
            data?.email,
            data?.domain,
          ]) || 'Company and identity enrichment collected from Clearbit.',
          sourceUrl: pickFirst(data?.url, data?.person?.linkedin?.url, data?.company?.website, null),
        };
      case 'securityTrails':
        return parseSecurityTrailsSummary(data);
      case 'ipApi':
        return parseIpSummary(data);
      case 'abuseIpDb':
        return parseAbuseIpSummary(data);
      case 'geoapify':
        return parseGeoapifySummary(data);
      case 'hunter':
        return parseHunterSummary(data);
      case 'numverify':
        return parseNumverifySummary(data);
      case 'shodan':
        return parseShodanSummary(data);
      case 'virusTotal':
        return parseVirusTotalSummary(data);
      case 'socialLookup':
        return parseSocialSummary(data);
      default:
        break;
    }

    const title = pickFirst(data?.name, data?.title, data?.domain, data?.query, data?.full_name, provider.name) ?? provider.name;
    const text = toSentence([
      data?.summary,
      data?.description,
      data?.message,
      data?.country,
      data?.location,
      data?.company,
    ]) || 'External API result collected.';

    return { title: String(title), text, sourceUrl: pickFirst(data?.url, data?.homepage, data?.sourceUrl, null) };
  })();

  return {
    provider: provider.name,
    category: provider.category,
    title: normalized.title,
    text: normalized.text,
    source: `${provider.name} (RapidAPI)`,
    sourceUrl: normalized.sourceUrl,
  };
}
