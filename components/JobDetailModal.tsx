'use client';

import { useState, useEffect } from 'react';
import styles from './JobDetailModal.module.css';

interface JobDetail {
  techStack: string;
  yearsOfExperience: string;
  summary: string;
  otherDetails: string;
  _source?: string;
  _charCount?: number;
  _url?: string;
  _finalUrl?: string | null;
}

interface JobData {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary?: string;
  created?: string;
}

interface Props {
  job: JobData;
  onClose: () => void;
  onFinalUrl?: (jobId: string, finalUrl: string) => void;
}

function splitList(text: string): string[] {
  return text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function extractYear(text: string): string {
  const match = text.match(/(\d+\+?)\s*(?:year|yr)s?/i);
  if (match) return match[1] + '+ years';
  return text.trim() || '—';
}

function toBullets(text: string, max: number): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
  return sentences.slice(0, max);
}

export default function JobDetailModal({ job, onClose, onFinalUrl }: Props) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDescription = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jobs/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: job.url,
          title: job.title,
          company: job.company,
          description: job.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch');
      setDetail(data);
      if (data._finalUrl && onFinalUrl) {
        onFinalUrl(job.id, data._finalUrl);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load description');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDescription(); }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>{job.title}</h2>
            <span className={styles.company}>
              {job.company}
              {job.location && <span className={styles.locationBadge}>{job.location}</span>}
            </span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {loading && (
            <div className={styles.loadingState}>
              <div className={styles.spinner} />
              <span>Loading…</span>
            </div>
          )}

          {error && (
            <div className={styles.errorState}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
              <button className={styles.retryBtn} onClick={fetchDescription}>Retry</button>
            </div>
          )}

          {detail && !loading && (
            <div className={styles.grid}>
              {detail._source && (
                <div className={styles.sourceRow}>
                  <div className={styles.sourceInfo}>
                    <span className={`${styles.sourceTag} ${detail._source === 'scraped' ? styles.sourceScraped : detail._source === 'blocked' ? styles.sourceBlocked : styles.sourceApi}`}>
                      {detail._source === 'scraped' ? '✓ Page scraped' : detail._source === 'blocked' ? '☁️ Blocked by Cloudflare' : '⚠ API description'}
                    </span>
                    <span className={styles.charCount}>{detail._charCount?.toLocaleString()} chars</span>
                  </div>
                  <div className={styles.sourceUrls}>
                    {detail._finalUrl && detail._finalUrl !== detail._url && (
                      <span className={styles.sourceUrl} title="Final URL after redirect">
                        ↳ {detail._finalUrl.slice(0, 65)}…
                      </span>
                    )}
                    {detail._url && (
                      <span className={styles.sourceUrl} title="Original Adzuna URL">
                        {detail._url.slice(0, 65)}…
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Skills &amp; Tech Stack</div>
                {(() => {
                  const items = splitList(detail.techStack);
                  if (items.length === 0) return <div className={styles.sectionValue}>—</div>;
                  return (
                    <ul className={styles.skillGrid}>
                      {items.map((item, i) => (
                        <li key={i} className={styles.skillItem}>{item}</li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              <div className={styles.section}>
                <div className={styles.sectionLabel}>Experience</div>
                <div className={styles.sectionValue}>• {extractYear(detail.yearsOfExperience)}</div>
              </div>

              <div className={styles.sectionFull}>
                <div className={styles.sectionLabel}>Details</div>
                {(() => {
                  const bullets = toBullets(detail.summary, 5);
                  if (bullets.length === 0) return <p className={styles.sectionText}>—</p>;
                  return (
                    <ul className={styles.bulletList}>
                      {bullets.map((b, i) => (
                        <li key={i} className={styles.bulletItem}>{b}</li>
                      ))}
                    </ul>
                  );
                })()}
              </div>

              <div className={styles.sectionFull}>
                <div className={styles.sectionLabel}>Additional Info</div>
                {(() => {
                  const bullets = toBullets(detail.otherDetails, 5);
                  if (bullets.length === 0) return <p className={styles.sectionText}>—</p>;
                  return (
                    <ul className={styles.bulletList}>
                      {bullets.map((b, i) => (
                        <li key={i} className={styles.bulletItem}>{b}</li>
                      ))}
                    </ul>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {(detail?._finalUrl || job.url) && (
            <a
              href={detail?._finalUrl || job.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.applyNowBtn}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Apply Now
            </a>
          )}
          <a
            href={detail?._finalUrl || job.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.viewOriginalBtn}
            title={detail?._finalUrl || job.url}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            View Original
          </a>
          <button className={styles.doneBtn} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
