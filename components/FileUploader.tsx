'use client';

import { useCallback, useState } from 'react';
import styles from './FileUploader.module.css';

const ACCEPTED = ['.csv', '.xlsx', '.xls', '.pdf', '.docx', '.doc', '.txt'];

interface Props {
  onUpload: (contacts: { name: string; email: string }[], filename: string) => void;
  onLoading: (v: boolean) => void;
  loading: boolean;
}

export default function FileUploader({ onUpload, onLoading, loading }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED.includes(ext)) {
      setError(`"${ext}" is not supported. Please upload ${ACCEPTED.join(', ')}.`);
      return;
    }
    setLastFile(file.name);
    onLoading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const res = await fetch('/api/parse', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not parse this file');
      if (!data.contacts.length) { setError('No email addresses were found in this file.'); return; }
      onUpload(data.contacts, file.name);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unexpected error. Try again.');
    } finally {
      onLoading(false);
    }
  }, [onUpload, onLoading]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className={styles.wrapper}>
      <div
        className={`${styles.zone} ${dragOver ? styles.zoneOver : ''} ${loading ? styles.zoneLoading : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !loading && (document.getElementById('_fu') as HTMLInputElement)?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && (document.getElementById('_fu') as HTMLInputElement)?.click()}
        aria-label="Upload file"
      >
        <input id="_fu" type="file" accept={ACCEPTED.join(',')} style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />

        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p className={styles.loadingTitle}>Parsing <em>{lastFile}</em></p>
            <p className={styles.loadingSub}>Auto-detecting email columns…</p>
          </div>
        ) : (
          <div className={styles.idleState}>
            <div className={styles.iconWrap}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className={styles.idleTitle}>
              {dragOver ? 'Release to upload' : 'Drop your file here'}
            </p>
            <p className={styles.idleSub}>
              or <span className={styles.browse}>browse to choose a file</span>
            </p>
            <div className={styles.badges}>
              {ACCEPTED.map(t => (
                <span key={t} className={styles.badge}>{t.slice(1).toUpperCase()}</span>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className={styles.error}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
