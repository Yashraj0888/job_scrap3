'use client';

import { useState, useEffect, useCallback } from 'react';
import JobDetailModal from './JobDetailModal';
import CustomSelect from './CustomSelect';
import styles from './JobSearch.module.css';

const LS_KEY = 'mb-jobs-search';

interface Job {
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

interface Contact {
  name: string;
  email: string;
  company?: string;
  [key: string]: any;
}

interface SavedState {
  query: string;
  location: string;
  country: string;
  contractType: string;
  contractTime: string;
  maxDaysOld: string;
  experience: string;
  jobs: Job[];
  total: number;
  totalPages: number;
  currentPage: number;
  selectedIds: string[];
  searched: boolean;
  finalUrls: Record<string, string>;
}

interface Props {
  onUpload: (contacts: Contact[], filename: string) => void;
  geminiApiKey?: string;
}

export default function JobSearch({ onUpload, geminiApiKey }: Props) {
  const [query, setQuery] = useState('Software Engineer');
  const [location, setLocation] = useState('');
  const [adzunaAppId, setAdzunaAppId] = useState('');
  const [adzunaApiKey, setAdzunaApiKey] = useState('');
  const [country, setCountry] = useState('in');
  const [contractType, setContractType] = useState('');
  const [contractTime, setContractTime] = useState('');
  const [maxDaysOld, setMaxDaysOld] = useState('');
  const [experience, setExperience] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [detailJob, setDetailJob] = useState<Job | null>(null);
  const [finalUrls, setFinalUrls] = useState<Record<string, string>>({});

  // ── Restore from localStorage on mount ─────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved: SavedState = JSON.parse(raw);
        setQuery(saved.query || '');
        setLocation(saved.location || '');
        setCountry(saved.country || 'in');
        setContractType(saved.contractType || '');
        setContractTime(saved.contractTime || '');
        setMaxDaysOld(saved.maxDaysOld || '');
        setExperience(saved.experience || '');
        setJobs(saved.jobs || []);
        setTotal(saved.total || 0);
        setTotalPages(saved.totalPages || 0);
        setCurrentPage(saved.currentPage || 1);
        setSelectedIds(new Set(saved.selectedIds || []));
        setSearched(saved.searched || false);
        setFinalUrls(saved.finalUrls || {});
      }
    } catch {}
    setInitialized(true);
  }, []);

  // ── Save to localStorage whenever state changes ──
  useEffect(() => {
    if (!initialized) return;
    const payload: SavedState = {
      query, location, country,
      contractType, contractTime, maxDaysOld, experience,
      jobs, total, totalPages, currentPage,
      selectedIds: Array.from(selectedIds),
      searched,
      finalUrls,
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(payload));
    } catch {}
  }, [query, location, country, contractType, contractTime, maxDaysOld, experience,
      jobs, total, totalPages, currentPage, selectedIds, searched, initialized, finalUrls]);

  const buildFilters = useCallback(() => {
    const filters: Record<string, any> = {};
    if (contractType) filters.contractType = contractType;
    if (contractTime) filters.contractTime = contractTime;
    if (maxDaysOld) filters.maxDaysOld = parseInt(maxDaysOld, 10);
    return filters;
  }, [contractType, contractTime, maxDaysOld]);

  const buildSearchQuery = useCallback(() => {
    let q = query.trim();
    if (experience === 'junior') q = `junior ${q}`;
    else if (experience === 'mid') q = `mid ${q}`;
    else if (experience === 'senior') q = `senior ${q}`;
    return q;
  }, [query, experience]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setError(null);
    setLoading(true);
    setCurrentPage(1);

    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: buildSearchQuery(),
          location: location.trim(),
          adzunaAppId: adzunaAppId.trim() || undefined,
          adzunaApiKey: adzunaApiKey.trim() || undefined,
          country,
          filters: buildFilters(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Search failed');
      }

      const sorted = (data.jobs || []).sort((a: Job, b: Job) =>
        new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime()
      );
      setJobs(sorted);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setSelectedIds(new Set());
      setSearched(true);

      if (!data.jobs?.length) {
        setError('No jobs found. Try different keywords, location, or filters.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Search request failed');
    } finally {
      setLoading(false);
    }
  }, [query, location, country, adzunaAppId, adzunaApiKey, buildFilters, buildSearchQuery]);

  const loadPage = useCallback(async (page: number) => {
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/jobs/page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: buildSearchQuery(),
          location: location.trim(),
          adzunaAppId: adzunaAppId.trim() || undefined,
          adzunaApiKey: adzunaApiKey.trim() || undefined,
          country,
          page,
          filters: buildFilters(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to load page');
      }

      const sorted = (data.jobs || []).sort((a: Job, b: Job) =>
        new Date(b.created || 0).getTime() - new Date(a.created || 0).getTime()
      );
      setJobs(sorted);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
      setCurrentPage(page);
      setSelectedIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Page load failed');
    } finally {
      setLoading(false);
    }
  }, [query, location, country, adzunaAppId, adzunaApiKey, buildFilters, buildSearchQuery]);

  const toggleJob = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredJobs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredJobs.map((j) => j.id)));
    }
  };

  const handleAddToCampaign = async () => {
    const selectedJobs = jobs.filter((j) => selectedIds.has(j.id));
    if (!selectedJobs.length) return;

    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/jobs/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobs: selectedJobs }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Conversion failed');
      }

      onUpload(data.contacts, `Jobs - ${query}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to prepare contacts');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 0) return 'Today';
      if (diff === 1) return 'Yesterday';
      if (diff < 7) return `${diff}d ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '—';
    }
  };

  // ── Client-side search ─────────────────────────────
  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      job.title?.toLowerCase().includes(q) ||
      job.company?.toLowerCase().includes(q) ||
      job.location?.toLowerCase().includes(q)
    );
  });

  // ── Pagination helpers ─────────────────────────────
  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;
  const pageNumbers: number[] = [];
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  for (let p = startPage; p <= endPage; p++) pageNumbers.push(p);

  if (!initialized) return null;

  return (
    <div className={styles.wrapper}>
      {/* ── Search Form ──────────────────────────────── */}
      <div className={styles.searchCard}>
        <div className={styles.searchHeader}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Find Jobs
        </div>

        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label}>Job Title / Keywords</label>
            <input
              className={`field-input ${styles.input}`}
              type="text" placeholder="e.g. Software Engineer"
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Location <span className={styles.optionalTag}>optional</span></label>
            <input
              className={`field-input ${styles.input}`}
              type="text" placeholder="e.g. Bengaluru, Mumbai"
              value={location} onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <span className={styles.locationHint}>Use city name only (e.g. "Bengaluru" not "Bangalore, India")</span>
          </div>
        </div>

        {/* ── Filters row ──────────────────────────────── */}
        <div className={styles.filterGrid}>
          <div className={styles.field}>
            <label className={styles.smallLabel}>Experience</label>
            <CustomSelect
              value={experience}
              onChange={(value) => setExperience(value)}
              options={[
                { value: '', label: 'Any' },
                { value: 'junior', label: 'Entry Level / Junior' },
                { value: 'mid', label: 'Mid Level' },
                { value: 'senior', label: 'Senior' },
              ]}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.smallLabel}>Contract Type</label>
            <CustomSelect
              value={contractType}
              onChange={(value) => setContractType(value)}
              options={[
                { value: '', label: 'All Types' },
                { value: 'permanent', label: 'Permanent' },
                { value: 'contract', label: 'Contract' },
              ]}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.smallLabel}>Job Time</label>
            <CustomSelect
              value={contractTime}
              onChange={(value) => setContractTime(value)}
              options={[
                { value: '', label: 'All Times' },
                { value: 'full_time', label: 'Full-Time' },
                { value: 'part_time', label: 'Part-Time' },
              ]}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.smallLabel}>Posted Within</label>
            <CustomSelect
              value={maxDaysOld}
              onChange={(value) => setMaxDaysOld(value)}
              options={[
                { value: '', label: 'Any Time' },
                { value: '1', label: '24 Hours' },
                { value: '3', label: '3 Days' },
                { value: '7', label: '7 Days' },
                { value: '14', label: '14 Days' },
                { value: '30', label: '30 Days' },
              ]}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.smallLabel}>Country</label>
            <CustomSelect
              value={country}
              onChange={(value) => setCountry(value)}
              options={[
                { value: 'in', label: '🇮🇳 India' },
                { value: 'us', label: '🇺🇸 US' },
                { value: 'gb', label: '🇬🇧 UK' },
                { value: 'ca', label: '🇨🇦 Canada' },
                { value: 'au', label: '🇦🇺 Australia' },
                { value: 'de', label: '🇩🇪 Germany' },
                { value: 'sg', label: '🇸🇬 Singapore' },
                { value: 'ae', label: '🇦🇪 UAE' },
              ]}
            />
          </div>
          <div className={styles.filterActions}>
            <button
              className="btn-primary"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <><div className={styles.miniSpinner} /> Searching…</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg> Search</>
              )}
            </button>
            <button
              className={styles.resetBtn}
              onClick={() => {
                setContractType('');
                setContractTime('');
                setMaxDaysOld('');
                setExperience('');
                setLocation('');
                setCountry('in');
                setJobs([]);
                setTotal(0);
                setTotalPages(0);
                setCurrentPage(1);
                setSelectedIds(new Set());
                setSearched(false);
                setError(null);
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
              </svg>
              Reset Filters
            </button>
          </div>
        </div>

        <a href="https://developer.adzuna.com" target="_blank" rel="noopener noreferrer" className={styles.link}>
          Get free Adzuna App ID &amp; API Key →
        </a>
      </div>

      {error && (
        <div className={styles.error}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* ── Results ──────────────────────────────────── */}
      {searched && !loading && (
        <div className={styles.resultsCard}>
          <div className={styles.resultsHeader}>
            <span className={styles.resultsCount}>
              {total.toLocaleString()} job{total !== 1 ? 's' : ''} found
              {totalPages > 0 && (
                <span className={styles.totalAvail}> · Page {currentPage} of {totalPages.toLocaleString()}</span>
              )}
            </span>
            <span className={styles.selectedCount}>
              {selectedIds.size} selected
            </span>
          </div>

          {filteredJobs.length > 0 && (
            <>
              <div className={styles.searchBar}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  className={styles.searchBarInput}
                  placeholder="Search in title, company, location…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <span className={styles.searchBarCount}>
                    {filteredJobs.length} of {jobs.length}
                  </span>
                )}
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.chkTh}>
                        <input
                          type="checkbox" className={styles.chk}
                          checked={selectedIds.size === filteredJobs.length && filteredJobs.length > 0}
                          onChange={toggleAll}
                        />
                      </th>
                      <th>Title</th>
                      <th>Company</th>
                      <th>Location</th>
                      <th>Apply</th>
                      <th>Posted</th>
                      <th>Category</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => {
                      const isSelected = selectedIds.has(job.id);
                      return (
                        <tr
                          key={job.id}
                          className={`${styles.row} ${isSelected ? styles.selected : ''}`}
                          onClick={() => toggleJob(job.id)}
                        >
                          <td className={styles.chkTd} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox" className={styles.chk}
                              checked={isSelected}
                              onChange={() => toggleJob(job.id)}
                            />
                          </td>
                          <td>
                            <div className={styles.jobTitle}>{job.title}</div>
                            {job.description && (
                              <div className={styles.jobDesc}>{job.description.slice(0, 120)}</div>
                            )}
                          </td>
                          <td className={styles.companyCell}>{job.company}</td>
                          <td className={styles.locationCell}>{job.location || '—'}</td>
                          <td className={styles.applyCell}>
                            {finalUrls[job.id] || job.url ? (
                              <a
                                href={finalUrls[job.id] || job.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.applyBtn}
                                onClick={(e) => e.stopPropagation()}
                              >
                                Apply Now
                              </a>
                            ) : (
                              <span className={styles.applyDisabled}>—</span>
                            )}
                          </td>
                          <td className={styles.dateCell}>{formatDate(job.created)}</td>
                          <td className={styles.catCell}>{job.category || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ────────────────────────── */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <button
                    className={`${styles.pageBtn} ${!canGoPrev ? styles.pageBtnDisabled : ''}`}
                    disabled={!canGoPrev || loading}
                    onClick={() => loadPage(currentPage - 1)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Prev
                  </button>

                  {startPage > 1 && (
                    <>
                      <button className={styles.pageBtn} onClick={() => loadPage(1)} disabled={loading}>1</button>
                      {startPage > 2 && <span className={styles.pageEllipsis}>…</span>}
                    </>
                  )}

                  {pageNumbers.map((p) => (
                    <button
                      key={p}
                      className={`${styles.pageBtn} ${p === currentPage ? styles.pageBtnActive : ''}`}
                      onClick={() => loadPage(p)}
                      disabled={loading}
                    >
                      {p}
                    </button>
                  ))}

                  {endPage < totalPages && (
                    <>
                      {endPage < totalPages - 1 && <span className={styles.pageEllipsis}>…</span>}
                      <button className={styles.pageBtn} onClick={() => loadPage(totalPages)} disabled={loading}>{totalPages}</button>
                    </>
                  )}

                  <button
                    className={`${styles.pageBtn} ${!canGoNext ? styles.pageBtnDisabled : ''}`}
                    disabled={!canGoNext || loading}
                    onClick={() => loadPage(currentPage + 1)}
                  >
                    Next
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}

          {selectedIds.size > 0 && (
            <div className={styles.actions}>
              <div className={styles.actionLeft}>
                {selectedIds.size === 1 && (() => {
                  const singleJob = jobs.find((j) => j.id === [...selectedIds][0]);
                  return singleJob?.url ? (
                    <button
                      className={styles.prominentDetailBtn}
                      onClick={() => setDetailJob(singleJob)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      See Job Description
                    </button>
                  ) : null;
                })()}
                <span className={styles.actionHint}>
                  {selectedIds.size} job{selectedIds.size !== 1 ? 's' : ''} → contacts with guessed emails.
                  You can edit them in the next step.
                </span>
              </div>
              <button
                className="btn-primary"
                onClick={handleAddToCampaign}
                disabled={loading}
              >
                {loading ? (
                  <><div className={styles.miniSpinner} /> Preparing…</>
                ) : (
                  <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="3 3 21 12 3 21 8 12" />
                  </svg> Add {selectedIds.size} to Campaign</>
                )}
              </button>
            </div>
          )}

          {detailJob && (
            <JobDetailModal
              job={detailJob}
              onClose={() => setDetailJob(null)}
              onFinalUrl={(jobId, finalUrl) => {
                setFinalUrls((prev) => ({ ...prev, [jobId]: finalUrl }));
              }}
            />
          )}
        </div>
      )}

      {searched && !loading && jobs.length > 0 && selectedIds.size === 0 && (
        <div className={styles.hintCard}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Select jobs above, then click <strong>"Add to Campaign"</strong> to generate recruiter contacts and start your outreach.
        </div>
      )}
    </div>
  );
}
