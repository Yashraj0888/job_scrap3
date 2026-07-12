'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import FileUploader from '@/components/FileUploader';
import ContactsPreview from '@/components/ContactsPreview';
import CampaignForm from '@/components/CampaignForm';
import JobSearch from '@/components/JobSearch';
import ProgressDashboard, { EmailEvent } from '@/components/ProgressDashboard';
import { useTheme } from '@/components/ThemeProvider';
import styles from './page.module.css';

type Step = 'upload' | 'preview' | 'compose' | 'sending';
interface Contact { name: string; email: string; company?: string; suggestedEmails?: string; aiSource?: string; jobTitle?: string; jobLocation?: string; jobUrl?: string; jobSalary?: string; jobDescription?: string }

const STEPS: { id: Step; label: string; icon: React.ReactNode }[] = [
  {
    id: 'upload',
    label: 'Upload',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
  },
  {
    id: 'preview',
    label: 'Contacts',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  },
  {
    id: 'compose',
    label: 'Compose',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    ),
  },
  {
    id: 'sending',
    label: 'Send',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    ),
  },
];

export default function Home() {
  const router = useRouter();
  const { theme, toggle } = useTheme();

  // Authentication states
  const [user, setUser] = useState<{
    email: string;
    name: string;
    picture: string;
    sender_email?: string;
    sender_password?: string;
    gemini_api_key?: string;
  } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Layout & History states
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'jobs'>('new');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
  const [selectedCampaignContacts, setSelectedCampaignContacts] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Wizard state
  const [step, setStep] = useState<Step>('upload');
  const [stepDir, setStepDir] = useState<'forward' | 'backward'>('forward');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filename, setFilename] = useState('');
  const [uploading, setUploading] = useState(false);
  const prevStep = useRef<Step>('upload');

  // Sending state
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [sendDone, setSendDone] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [senderEmail, setSenderEmail] = useState('');
  const [senderPassword, setSenderPassword] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [liveStatus, setLiveStatus] = useState<{ phase: string; message: string; seconds?: number } | null>(null);
  const [runningCampaignId, setRunningCampaignId] = useState<string | null>(null);
  const [totalContactsCount, setTotalContactsCount] = useState(0);

  // History active sending states
  const [historySending, setHistorySending] = useState(false);
  const [historyEvents, setHistoryEvents] = useState<EmailEvent[] | null>(null);
  const [historyLiveStatus, setHistoryLiveStatus] = useState<{ phase: string; message: string; seconds?: number } | null>(null);
  const [historyDone, setHistoryDone] = useState(false);
  const [historyError, setHistoryError] = useState<string | undefined>();

  // 1. Session Verification on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.user) {
          setUser(data.user);
          // Auto-resume held campaigns in background
          fetch('/api/campaigns/auto-resume', { method: 'POST' }).catch(() => {});
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      } finally {
        setCheckingAuth(false);
      }
    };
    checkSession();
  }, [router]);

  // 2. Fetch campaign history
  const fetchCampaigns = async () => {
    try {
      const res = await fetch('/api/campaigns');
      const data = await res.json();
      if (data.campaigns) {
        setCampaigns(data.campaigns);
      }
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    }
  };

  useEffect(() => {
    if (user && activeTab === 'history') {
      fetchCampaigns();
    }
  }, [user, activeTab]);

  // ── Persist state in localStorage ──────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('mb-wizard');
      if (saved) {
        const { step: s, contacts: c, filename: f } = JSON.parse(saved);
        if (s && s !== 'sending') {
          setStep(s);
          setContacts(c || []);
          setFilename(f || '');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (step !== 'sending') {
      try {
        localStorage.setItem('mb-wizard', JSON.stringify({ step, contacts, filename }));
      } catch {}
    }
  }, [step, contacts, filename]);

  const goTo = (next: Step) => {
    const order: Step[] = ['upload', 'preview', 'compose', 'sending'];
    setStepDir(order.indexOf(next) > order.indexOf(prevStep.current) ? 'forward' : 'backward');
    prevStep.current = next;
    setStep(next);
  };

  const handleUpload = (parsed: Contact[], fname: string) => {
    setContacts(parsed);
    setFilename(fname);
    setActiveTab('new');
    goTo('preview');
  };

  const handlePreviewConfirm = (confirmed: Contact[]) => {
    setContacts(confirmed);
    goTo('compose');
  };

  const handleSend = async (config: {
    senderEmail: string;
    senderPassword: string;
    subject: string;
    messageBody: string;
    attachments: { name: string; content: string }[];
    enableSafeMode: boolean;
    enableAISpintax: boolean;
    geminiApiKey?: string;
  }) => {
    setSenderEmail(config.senderEmail);
    setSenderPassword(config.senderPassword);
    setAttachments(config.attachments);
    setEvents([]);
    setSendDone(false);
    setSendError(undefined);
    setTotalContactsCount(contacts.length);
    goTo('sending');

    setUser(prev => prev ? {
      ...prev,
      sender_email: config.senderEmail,
      sender_password: config.senderPassword,
      gemini_api_key: config.geminiApiKey || prev.gemini_api_key
    } : null);

    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contacts, ...config }),
      });

      if (!res.ok || !res.body) { setSendError('Failed to connect. Check credentials.'); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            // Handle status/phase events separately
            if (data.type === 'status') {
              setLiveStatus({ phase: data.phase, message: data.message, seconds: data.seconds });
              if (data.phase === 'campaign_start' && data.campaignId) {
                setRunningCampaignId(data.campaignId);
                if (data.total) setTotalContactsCount(data.total);
              }
              continue;
            }
            if (data.error && data.done) { setSendError(data.error); setSendDone(true); setLiveStatus(null); return; }
            if (data.done) { setSendDone(true); setLiveStatus(null); }
            else { setEvents(prev => [...prev, data as EmailEvent]); }
          } catch {}
        }
      }
    } catch { setSendError('Network error. Please try again.'); }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/campaigns/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });
      if (res.ok) {
        if (selectedCampaign?.id === campaignId) {
          setSelectedCampaign(null);
          setSelectedCampaignContacts([]);
        }
        fetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to delete campaign:', err);
    }
  };

  const handleRetryCampaign = async (campaignId: string) => {
    setHistorySending(true);
    setHistoryEvents([]);
    setHistoryDone(false);
    setHistoryError(undefined);

    try {
      const res = await fetch('/api/campaigns/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId }),
      });

      if (!res.ok || !res.body) {
        setHistoryError('Failed to connect. Check credentials.');
        setHistoryDone(true);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'status') {
              setHistoryLiveStatus({ phase: data.phase, message: data.message, seconds: data.seconds });
              continue;
            }
            if (data.error && data.done) {
              setHistoryError(data.error);
              setHistoryDone(true);
              setHistoryLiveStatus(null);
              return;
            }
            if (data.done) {
              setHistoryDone(true);
              setHistoryLiveStatus(null);
            } else {
              setHistoryEvents(prev => [...(prev || []), data as EmailEvent]);
            }
          } catch {}
        }
      }
    } catch {
      setHistoryError('Network error. Please try again.');
      setHistoryDone(true);
    } finally {
      loadCampaignDetails(campaignId);
      fetchCampaigns();
    }
  };

  const loadCampaignDetails = async (campaignId: string) => {
    setLoadingDetails(true);
    setHistorySending(false);
    setHistoryEvents(null);
    setHistoryLiveStatus(null);
    setHistoryDone(false);
    setHistoryError(undefined);

    try {
      const res = await fetch(`/api/campaigns?id=${campaignId}`);
      const data = await res.json();
      if (data.campaign) {
        setSelectedCampaign(data.campaign);
        setSelectedCampaignContacts(data.contacts || []);
      }
    } catch (err) {
      console.error('Failed to load campaign details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const reset = () => {
    setStep('upload'); setContacts([]); setFilename('');
    setEvents([]); setSendDone(false); setSendError(undefined); setLiveStatus(null);
    setRunningCampaignId(null);
    prevStep.current = 'upload';
    try { localStorage.removeItem('mb-wizard'); } catch {}
  };

  if (checkingAuth) {
    return (
      <div className={styles.loaderWrap}>
        <div className={styles.mainSpinner} />
        <p>Verifying credentials…</p>
      </div>
    );
  }

  const stepIndex = STEPS.findIndex(s => s.id === step);

  return (
    <div className={styles.shell}>
      {/* ── Nav ─────────────────────────────────────── */}
      <nav className={styles.nav}>
        <div className={styles.navBrand}>
          <div className={styles.logoMark}>
            <img src="/envelope-mail.png" alt="Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          </div>
          <span className={styles.logoText}>Mail Maps</span>
        </div>
        
        <div className={styles.navActions}>
          {user && (
            <div className={styles.userProfile}>
              <img src={user.picture} alt={user.email.split('@')[0]} className={styles.userAvatar} />
              <span className={styles.userName}>{user.email.split('@')[0]}</span>
            </div>
          )}
          
          <button className={styles.themeBtn} onClick={toggle} aria-label="Toggle theme">
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>

          <button className={styles.logoutBtn} onClick={handleLogout} title="Sign Out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Main Layout ──────────────────────────────── */}
      <div className={styles.container}>
        
        {/* ── Sidebar ───────────────────────────────── */}
        <aside className={styles.sidebar}>
          <button
            className={`${styles.sidebarBtn} ${activeTab === 'new' ? styles.sidebarBtnActive : ''}`}
            onClick={() => { setActiveTab('new'); setSelectedCampaign(null); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Campaign
          </button>
          
          <button
            className={`${styles.sidebarBtn} ${activeTab === 'jobs' ? styles.sidebarBtnActive : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Find Jobs
          </button>

          <button
            className={`${styles.sidebarBtn} ${activeTab === 'history' ? styles.sidebarBtnActive : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            Campaign History
          </button>

          <div className={styles.sidebarDivider} />

          <span className={styles.sidebarSectionLabel}>Recent Campaigns</span>
          
          <div className={styles.campaignList}>
            {campaigns.length === 0 ? (
              <p className={styles.noCampaigns}>No past campaigns found.</p>
            ) : (
              campaigns.map(c => {
                const isSelected = selectedCampaign?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className={`${styles.campaignItem} ${isSelected ? styles.campaignItemActive : ''}`}
                    onClick={() => { setActiveTab('history'); loadCampaignDetails(c.id); }}
                    style={{ position: 'relative' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span className={styles.campaignSubject} style={{ marginRight: 24 }}>{c.subject}</span>
                      <button
                        className={styles.deleteCampaignBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCampaign(c.id);
                        }}
                        title="Delete Campaign"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                    <div className={styles.campaignMeta}>
                      <span className={`${styles.statusBadge} ${styles[c.status]}`}>{c.status}</span>
                      <span>{c.sent_count}/{c.total_contacts} sent</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* ── Workspace ─────────────────────────────── */}
        <main className={styles.workspace}>
          {activeTab === 'jobs' ? (
            <div className={styles.card}>
              <div className={styles.content} style={{ padding: '32px' }}>
                <JobSearch onUpload={handleUpload} geminiApiKey={user?.gemini_api_key || ''} />
              </div>
            </div>
          ) : activeTab === 'new' ? (
            <div className={styles.card}>
              {/* ── Step Rail ─────────────────────────── */}
              <div className={styles.stepRail}>
                {STEPS.map((s, i) => {
                  const isDone = i < stepIndex;
                  const isActive = i === stepIndex;
                  return (
                    <div key={s.id} className={styles.stepItem}>
                      <div className={`${styles.stepDot} ${isDone ? styles.stepDotDone : ''} ${isActive ? styles.stepDotActive : ''}`}>
                        {isDone ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        ) : (
                          <span>{s.icon}</span>
                        )}
                      </div>
                      <span className={`${styles.stepLabel} ${isActive ? styles.stepLabelActive : ''} ${isDone ? styles.stepLabelDone : ''}`}>
                        {s.label}
                      </span>
                      {i < STEPS.length - 1 && (
                        <div className={`${styles.stepLine} ${isDone ? styles.stepLineDone : ''}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ── Step Header ───────────────────────── */}
              <div className={styles.stepHeader}>
                <div>
                  <h1 className={styles.stepTitle}>
                    {step === 'upload' && 'Upload your contacts'}
                    {step === 'preview' && 'Review your list'}
                    {step === 'compose' && 'Write your message'}
                    {step === 'sending' && 'Campaign launched'}
                  </h1>
                  <p className={styles.stepDesc}>
                    {step === 'upload' && 'Drop any file — CSV, XLSX, PDF, DOCX, or TXT. We automatically detect the email column.'}
                    {step === 'preview' && `${contacts.length} contacts extracted from ${filename}. Remove any you don't want to email.`}
                    {step === 'compose' && 'Set up your sender account and craft your personalized message.'}
                    {step === 'sending' && 'Emails are being delivered — watch live progress below.'}
                  </p>
                </div>
                {step !== 'upload' && step !== 'sending' && (
                  <div className={styles.stepCount}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    </svg>
                    {contacts.length} contacts
                  </div>
                )}
              </div>

              {/* ── Content ───────────────────────────── */}
              <div className={styles.content} key={step} data-dir={stepDir}>
                {step === 'upload' && (
                  <FileUploader onUpload={handleUpload} onLoading={setUploading} loading={uploading} />
                )}
                {step === 'preview' && (
                  <ContactsPreview
                    contacts={contacts}
                    filename={filename}
                    onConfirm={handlePreviewConfirm}
                    onBack={() => goTo('upload')}
                  />
                )}
                {step === 'compose' && (
                  <CampaignForm
                    contactCount={contacts.length}
                    initialSenderEmail={user?.sender_email || user?.email || ''}
                    initialSenderPassword={user?.sender_password || ''}
                    initialGeminiApiKey={user?.gemini_api_key || ''}
                    onSend={handleSend}
                    onBack={() => goTo('preview')}
                  />
                )}
                {step === 'sending' && (
                  <ProgressDashboard
                    events={events}
                    setEvents={setEvents}
                    total={contacts.length}
                    done={sendDone}
                    error={sendError}
                    onReset={reset}
                    senderEmail={senderEmail}
                    senderPassword={senderPassword}
                    attachments={attachments}
                    liveStatus={liveStatus}
                    campaignId={runningCampaignId}
                  />
                )}
              </div>
            </div>
          ) : (
            // Campaign History dashboard view
            <div className={styles.card}>
              {selectedCampaign ? (
                <div className={styles.historyDetails}>
                  <div className={styles.historyHeader}>
                    <div>
                      <span className={`${styles.statusBadge} ${styles[selectedCampaign.status]}`} style={{ marginBottom: 8, display: 'inline-block' }}>
                        {selectedCampaign.status}
                      </span>
                      <h2 className={styles.campaignTitle}>{selectedCampaign.subject}</h2>
                      <p className={styles.campaignDesc}>Created on {new Date(selectedCampaign.created_at).toLocaleString()}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      {selectedCampaignContacts.filter(c => c.status !== 'sent').length > 0 && (
                        <button
                          className="btn-primary"
                          onClick={() => handleRetryCampaign(selectedCampaign.id)}
                          style={{ background: 'var(--warning)', borderColor: 'var(--warning)', boxShadow: 'none' }}
                        >
                          Retry Failed / Resume ({selectedCampaignContacts.filter(c => c.status !== 'sent').length})
                        </button>
                      )}
                      <button className="btn-ghost" onClick={() => setSelectedCampaign(null)}>
                        Back to History
                      </button>
                    </div>
                  </div>

                  {/* Simulated ProgressDashboard props in history mode */}
                  <ProgressDashboard
                    events={historyEvents || selectedCampaignContacts.map((c, idx) => ({
                      index: idx,
                      total: selectedCampaignContacts.length,
                      email: c.email,
                      name: c.name,
                      status: c.status,
                      sentCount: selectedCampaign.sent_count,
                      failedCount: selectedCampaign.failed_count,
                      error: c.error_message,
                      subject: c.sent_subject || selectedCampaign.subject,
                      body: c.sent_body || selectedCampaign.body
                    }))}
                    setEvents={historySending ? (setHistoryEvents as any) : (setSelectedCampaignContacts as any)}
                    total={selectedCampaignContacts.length}
                    done={historySending ? historyDone : (selectedCampaign.status === 'completed' || selectedCampaign.status === 'stopped')}
                    error={historySending ? historyError : undefined}
                    onReset={() => setSelectedCampaign(null)}
                    senderEmail={selectedCampaign.sender_email}
                    senderPassword={selectedCampaign.sender_password}
                    liveStatus={historySending ? historyLiveStatus : null}
                    campaignId={selectedCampaign.id}
                  />
                </div>
              ) : (
                <div className={styles.historySelectPrompt}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ color: 'var(--text-3)' }}>
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <h3>Select a Campaign</h3>
                  <p>Choose an outreach campaign from the sidebar to review recruiter logs, edit templates, or resend failed messages.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <footer className={styles.footer}>
        <p>Mail Maps &nbsp;·&nbsp; Created by Yashraj ❤️</p>
      </footer>
    </div>
  );
}
