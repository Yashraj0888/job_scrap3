'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './ProgressDashboard.module.css';

export interface EmailEvent {
  index: number;
  total: number;
  email: string;
  name: string;
  status: 'sent' | 'failed' | 'pending' | 'stopped';
  sentCount: number;
  failedCount: number;
  error?: string;
  subject?: string;
  body?: string;
}

export interface LiveStatus {
  phase: string;
  message: string;
  seconds?: number;
}

interface Props {
  events: EmailEvent[];
  setEvents?: React.Dispatch<React.SetStateAction<EmailEvent[]>>;
  total: number;
  done: boolean;
  error?: string;
  onReset: () => void;
  senderEmail?: string;
  senderPassword?: string;
  attachments?: any[];
  liveStatus?: LiveStatus | null;
  campaignId?: string | null;
}

export default function ProgressDashboard({
  events,
  setEvents,
  total,
  done,
  error,
  onReset,
  senderEmail,
  senderPassword,
  attachments,
  liveStatus,
  campaignId,
}: Props) {
  const logRef = useRef<HTMLDivElement>(null);
  const [selectedEvent, setSelectedEvent] = useState<EmailEvent | null>(null);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [isResending, setIsResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [resendErrorMsg, setResendErrorMsg] = useState<string | undefined>();

  // Phase icon mapping
  const phaseIcon: Record<string, React.ReactNode> = {
    ai_start: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
    ai_done: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
    ai_error: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    ),
    auth: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    ),
    auth_ok: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    campaign_start: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
    sending: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
    countdown: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    default: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    ),
  };

  const sent = events.filter((e) => e.status === 'sent').length;
  const failed = events.filter((e) => e.status === 'failed').length;
  const processed = events.length;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  const handleRowClick = (ev: EmailEvent) => {
    setSelectedEvent(ev);
    setEditSubject(ev.subject || '');
    setEditBody(ev.body || '');
    setResendStatus('idle');
    setResendErrorMsg(undefined);
  };

  const handleResend = async () => {
    if (!selectedEvent || !senderEmail || !senderPassword) return;
    setIsResending(true);
    setResendStatus('idle');
    setResendErrorMsg(undefined);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contacts: [{ name: selectedEvent.name, email: selectedEvent.email }],
          senderEmail,
          senderPassword,
          subject: editSubject,
          messageBody: editBody,
          attachments,
          enableSafeMode: false, // Send immediately for manual resends
          enableAISpintax: false, // Use exactly what the user edited
        }),
      });

      if (!res.ok) throw new Error('Resend request failed.');

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let doneReading = false;
      let success = false;
      let apiError = '';

      if (reader) {
        while (!doneReading) {
          const { value, done: isDone } = await reader.read();
          doneReading = isDone;
          if (value) {
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const parsed = JSON.parse(line.slice(6));
                if (parsed.status === 'sent') success = true;
                if (parsed.status === 'failed') apiError = parsed.error;
                if (parsed.error && parsed.done) apiError = parsed.error;
              }
            }
          }
        }
      }

      if (success) {
        setResendStatus('success');
        if (setEvents) {
          setEvents((prev) =>
            prev.map((ev) => {
              if (ev.index === selectedEvent.index) {
                return {
                  ...ev,
                  status: 'sent',
                  subject: editSubject,
                  body: editBody,
                  error: undefined,
                };
              }
              return ev;
            })
          );
        }
        setTimeout(() => setSelectedEvent(null), 1000);
      } else {
        setResendStatus('failed');
        setResendErrorMsg(apiError || 'Delivery failed.');
      }
    } catch (err: any) {
      setResendStatus('failed');
      setResendErrorMsg(err.message || 'Resend failed.');
    } finally {
      setIsResending(false);
    }
  };

  const [resetting, setResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [stopping, setStopping] = useState(false);

  const handleStopCampaign = async () => {
    if (!campaignId) return;
    setStopping(true);
    try {
      await fetch('/api/campaigns/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
    } catch (err) {
      console.error('Failed to stop campaign:', err);
    } finally {
      setStopping(false);
    }
  };

  const handleResetLimit = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/campaigns/reset-limit', { method: 'POST' });
      if (res.ok) {
        setResetSuccess(true);
        setTimeout(() => {
          setResetSuccess(false);
          onReset();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {error ? (
        <div className={styles.errorCard} style={{ flexDirection: 'column', gap: '16px', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            <div className={styles.errorIcon}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <div>
              <p className={styles.errorTitle}>Campaign Halted</p>
              <p className={styles.errorMsg}>{error}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button className="btn-ghost" onClick={onReset}>Dismiss</button>
            <button 
              className="btn-primary" 
              onClick={handleResetLimit}
              disabled={resetting || resetSuccess}
              style={{ background: 'var(--warning)', borderColor: 'var(--warning)', boxShadow: 'none' }}
            >
              {resetting ? 'Resetting...' : resetSuccess ? 'Limit Reset!' : 'Reset Daily Limit Count'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Live Activity Strip */}
          {!done && liveStatus && (
            <div className={`${styles.activityStrip} ${styles['phase_' + liveStatus.phase] || ''}`}>
              <div className={styles.activityLeft}>
                <span className={`${styles.activityPulse} ${
                  liveStatus.phase === 'countdown' ? styles.activityPulseWarn :
                  liveStatus.phase.startsWith('ai') ? styles.activityPulseAi :
                  liveStatus.phase === 'sending' ? styles.activityPulseSend : ''
                }`} />
                <span className={`${styles.activityIcon} ${
                  liveStatus.phase === 'sending' ? styles.activityIconSend :
                  liveStatus.phase.startsWith('ai') ? styles.activityIconAi :
                  liveStatus.phase === 'countdown' ? styles.activityIconWarn :
                  liveStatus.phase === 'auth_ok' ? styles.activityIconOk : ''
                }`}>
                  {phaseIcon[liveStatus.phase] || phaseIcon.default}
                </span>
                <span className={styles.activityMsg}>{liveStatus.message}</span>
              </div>
              {liveStatus.phase === 'countdown' && liveStatus.seconds !== undefined && (
                <div className={styles.countdownBadge}>
                  <svg className={styles.countdownRing} viewBox="0 0 36 36">
                    <circle className={styles.countdownBg} cx="18" cy="18" r="15" />
                    <circle
                      className={styles.countdownProgress}
                      cx="18" cy="18" r="15"
                      strokeDasharray={`${(liveStatus.seconds / 15) * 94} 94`}
                    />
                  </svg>
                  <span className={styles.countdownNum}>{liveStatus.seconds}</span>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className={styles.stats}>
            {[
              { label: 'Total', value: total, variant: '' },
              { label: 'Sent', value: sent, variant: 'success' },
              { label: 'Failed', value: failed, variant: 'error' },
              { label: 'Remaining', value: Math.max(0, total - processed), variant: 'muted' },
            ].map((s) => (
              <div key={s.label} className={`${styles.stat} ${s.variant ? styles[s.variant as keyof typeof styles] : ''}`}>
                <span className={styles.statVal}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className={styles.progressWrap}>
            <div className={styles.progressMeta}>
              <span>{done ? '🎉 Campaign complete!' : `Sending ${processed} / ${total}`}</span>
              <span className={styles.pct}>{pct}%</span>
            </div>
            <div className={styles.track}>
              <div className={`${styles.bar} ${done ? styles.barDone : ''}`} style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Log */}
          <div className={styles.log}>
            <div className={styles.logHead}>
              <span>Live log (Click row to view/resend email)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {!done && campaignId && (
                  <button
                    className={styles.stopBtn}
                    onClick={handleStopCampaign}
                    disabled={stopping}
                  >
                    {stopping ? 'Stopping...' : 'Stop Campaign'}
                  </button>
                )}
                {!done && (
                  <span className={styles.live}>
                    <span className={styles.liveDot} />
                    Live
                  </span>
                )}
              </div>
            </div>
            <div className={styles.logBody} ref={logRef}>
              {events.length === 0 && <p className={styles.logEmpty}>Waiting for first email…</p>}
              {events.map((ev, i) => {
                const isSent = ev.status === 'sent';
                const isFailed = ev.status === 'failed';
                const isPending = ev.status === 'pending';
                const isStopped = ev.status === 'stopped';

                let rowStatusClass = styles.logFailed;
                if (isSent) rowStatusClass = styles.logSent;
                else if (isPending) rowStatusClass = styles.logPending;
                else if (isStopped) rowStatusClass = styles.logStopped;

                return (
                  <div
                    key={i}
                    className={`${styles.logRow} ${rowStatusClass} ${styles.clickableRow}`}
                    onClick={() => handleRowClick(ev)}
                  >
                    <span className={styles.logIcon}>
                      {isSent ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : isPending ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      ) : isStopped ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="5" y="5" width="14" height="14" rx="2" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                    </span>
                    <span className={styles.logIdx}>#{ev.index + 1}</span>
                    <span className={styles.logEmail}>{ev.email}</span>
                    {ev.name && <span className={styles.logName}>{ev.name}</span>}
                    <span className={styles.logStatus}>
                      {isSent ? 'Delivered' : isPending ? 'Pending' : isStopped ? 'Stopped' : ev.error || 'Failed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Resend Modal */}
      {selectedEvent && (
        <div className={styles.modalOverlay} onClick={() => !isResending && setSelectedEvent(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Outreach Details</h3>
                <p className={styles.modalSub}>
                  Recipient: {selectedEvent.name || 'Recruiter'} &lt;{selectedEvent.email}&gt;
                </p>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setSelectedEvent(null)}
                disabled={isResending}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              {selectedEvent.status === 'failed' && (
                <div className={styles.modalError}>
                  <strong>Error:</strong> {selectedEvent.error || 'Unknown dispatch failure.'}
                </div>
              )}

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Subject Line</label>
                <input
                  type="text"
                  className="field-input"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  disabled={isResending}
                />
              </div>

              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Email Body</label>
                <textarea
                  className={`field-input ${styles.modalTextarea}`}
                  rows={8}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  disabled={isResending}
                />
              </div>

              {resendErrorMsg && (
                <div className={styles.modalError} style={{ marginTop: 8 }}>
                  <strong>Resend Error:</strong> {resendErrorMsg}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setSelectedEvent(null)}
                disabled={isResending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleResend}
                disabled={isResending || resendStatus === 'success'}
              >
                {isResending ? (
                  <>
                    <div className={styles.miniSpinner} />
                    Resending…
                  </>
                ) : resendStatus === 'success' ? (
                  '✓ Sent successfully'
                ) : (
                  'Resend Email'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {(done || error) && (
        <div className={styles.doneBar}>
          {done && !error && (
            <span className={styles.summary}>
              <strong>{sent}</strong> sent · <strong>{failed}</strong> failed
            </span>
          )}
          <button className="btn-primary" onClick={onReset}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
            </svg>
            New Campaign
          </button>
        </div>
      )}
    </div>
  );
}
