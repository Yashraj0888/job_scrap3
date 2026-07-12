export interface JobResult {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary?: string;
  salaryMin?: number;
  salaryMax?: number;
  contractType?: string;
  contractTime?: string;
  category?: string;
  created?: string;
}

interface AdzunaResult {
  id: string;
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  redirect_url: string;
  description: string;
  salary_min?: number;
  salary_max?: number;
  contract_type?: string;
  contract_time?: string;
  category?: { label: string; tag: string };
  created?: string;
  adref?: string;
}

interface AdzunaResponse {
  results: AdzunaResult[];
  count: number;
}

const RESULTS_PER_PAGE = 50;

export interface SearchFilters {
  contractType?: string;
  contractTime?: string;
  maxDaysOld?: number;
  salaryMin?: number;
  category?: string;
}

export async function searchAdzunaJobs(
  query: string,
  location: string,
  appId: string,
  appKey: string,
  country: string = 'us',
  filters?: SearchFilters
): Promise<{ jobs: JobResult[]; total: number; page: number; totalPages: number }> {
  return fetchPage(query, location, appId, appKey, country, 1, filters);
}

export async function fetchAdzunaPage(
  query: string,
  location: string,
  appId: string,
  appKey: string,
  country: string,
  page: number,
  filters?: SearchFilters
): Promise<{ jobs: JobResult[]; total: number; page: number; totalPages: number }> {
  return fetchPage(query, location, appId, appKey, country, page, filters);
}

function buildSearchParams(
  query: string,
  location: string,
  appId: string,
  appKey: string,
  page: number,
  filters?: SearchFilters
): URLSearchParams {
  const params = new URLSearchParams();
  params.set('app_id', appId);
  params.set('app_key', appKey);
  params.set('what', query);
  if (location) params.set('where', location);
  params.set('results_per_page', String(RESULTS_PER_PAGE));

  if (filters?.contractType) params.set('contract_type', filters.contractType);
  if (filters?.contractTime) params.set('contract_time', filters.contractTime);
  if (filters?.maxDaysOld) params.set('max_days_old', String(filters.maxDaysOld));
  if (filters?.salaryMin) params.set('salary_min', String(filters.salaryMin));
  if (filters?.category) params.set('category', filters.category);

  return params;
}

async function fetchPage(
  query: string,
  location: string,
  appId: string,
  appKey: string,
  country: string,
  page: number,
  filters?: SearchFilters,
  attempt: number = 1
): Promise<{ jobs: JobResult[]; total: number; page: number; totalPages: number }> {
  const params = buildSearchParams(query, location, appId, appKey, page, filters);
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;

  const res = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const text = await res.text();

    // Retry with progressively fewer filters on 400 errors (Adzuna can be finicky)
    if (res.status === 400 && attempt === 1 && filters) {
      const retryFilters = { ...filters };
      // Remove filters one at a time: contract detail first, then recency, then location substitute
      delete retryFilters.contractType;
      delete retryFilters.contractTime;
      const retryParams = buildSearchParams(query, location, appId, appKey, page, 
        Object.keys(retryFilters).length > 0 ? retryFilters : undefined);
      const retryUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${retryParams.toString()}`;
      
      const retryRes = await fetch(retryUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
      });

      if (retryRes.ok) {
        const data: AdzunaResponse = await retryRes.json();
        return parseResponse(data, page);
      }

      // Last resort: try with just query, no filters, no location
      const bareParams = new URLSearchParams();
      bareParams.set('app_id', appId);
      bareParams.set('app_key', appKey);
      bareParams.set('what', query);
      bareParams.set('results_per_page', String(RESULTS_PER_PAGE));
      const bareUrl = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${bareParams.toString()}`;
      
      const bareRes = await fetch(bareUrl, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(20000),
      });

      if (bareRes.ok) {
        const data: AdzunaResponse = await bareRes.json();
        return parseResponse(data, page);
      }
    }

    throw new Error(`Adzuna API error (${res.status}) page ${page} country "${country}" query "${query}": ${text.slice(0, 300)}`);
  }

  const data: AdzunaResponse = await res.json();
  return parseResponse(data, page);
}

function parseResponse(data: AdzunaResponse, page: number = 1) {
  const results: AdzunaResult[] = data.results || [];
  const total = data.count || 0;
  const totalPages = Math.ceil(total / RESULTS_PER_PAGE);

  const jobs = results.map((r: AdzunaResult) => ({
    id: r.id,
    title: r.title,
    company: r.company?.display_name || 'Unknown Company',
    location: r.location?.display_name || '',
    url: r.redirect_url || '',
    description: r.description?.replace(/<[^>]*>/g, '').slice(0, 4000) || '',
    salary: formatSalary(r.salary_min, r.salary_max),
    salaryMin: r.salary_min,
    salaryMax: r.salary_max,
    contractType: r.contract_type || '',
    contractTime: r.contract_time || '',
    category: r.category?.label || '',
    created: r.created || '',
  }));

  return { jobs, total, page, totalPages };
}

function formatSalary(min?: number, max?: number): string {
  if (!min && !max) return '';
  if (min && max) return `$${(min / 1000).toFixed(0)}K - $${(max / 1000).toFixed(0)}K`;
  if (min) return `From $${(min / 1000).toFixed(0)}K`;
  if (max) return `Up to $${(max / 1000).toFixed(0)}K`;
  return '';
}
