'use client';

import { useState } from 'react';
import styles from './CampaignForm.module.css';

interface AttachmentFile { name: string; content: string }

interface Props {
  contactCount: number;
  initialSenderEmail?: string;
  initialSenderPassword?: string;
  initialGeminiApiKey?: string;
  onSend: (config: {
    senderEmail: string;
    senderPassword: string;
    subject: string;
    messageBody: string;
    attachments: AttachmentFile[];
    enableSafeMode: boolean;
    enableAISpintax: boolean;
    geminiApiKey?: string;
  }) => void;
  onBack: () => void;
}

export default function CampaignForm({
  contactCount,
  initialSenderEmail = '',
  initialSenderPassword = '',
  initialGeminiApiKey = '',
  onSend,
  onBack,
}: Props) {
  const [senderEmail, setSenderEmail] = useState(initialSenderEmail);
  const [senderPassword, setSenderPassword] = useState(initialSenderPassword);
  const [geminiApiKey, setGeminiApiKey] = useState(initialGeminiApiKey);
  const [showPwd, setShowPwd] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [subject, setSubject] = useState('Software Developer seeking new opportunities | Yashraj Singh');
  const [body, setBody] = useState(`Hi Team,

I’m Yashraj Singh, currently working as a Full-Stack Developer at Aganitha Cognitive Solutions. I’m really interested in potential opportunities to join your company as a Software Developer.

Over the past year, I’ve focused on building robust web applications, optimizing performance, and writing clean, scalable code across modern tech stacks.

I’ve attached my resume for your review. If you have any open roles that match my background, I’d love to connect for a quick conversation. 

Thanks for your time, and look forward to hearing from you.

Best regards,

Yashraj Singh
Software Developer
www.linkedin.com/in/yashraj-singh-55804b253`);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [enableSafeMode, setEnableSafeMode] = useState(true);
  const [enableAISpintax, setEnableAISpintax] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!senderEmail.includes('@')) e.email = 'Enter a valid email';
    if (!senderPassword) e.pwd = 'App password is required';
    if (!subject.trim()) e.subject = 'Subject cannot be empty';
    if (!body.trim()) e.body = 'Message cannot be empty';
    if (enableAISpintax && !geminiApiKey.trim()) e.apiKey = 'Gemini API Key is required when AI Spintax is enabled';
    if (attachments.length === 0) e.attachments = 'Resume attachment is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files || []).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachments(prev => [...prev, { name: file.name, content: base64 }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const submit = () => {
    if (validate()) {
      onSend({
        senderEmail,
        senderPassword,
        subject,
        messageBody: body,
        attachments,
        enableSafeMode,
        enableAISpintax,
        geminiApiKey: enableAISpintax ? geminiApiKey : undefined,
      });
    }
  };

  return (
    <div className={styles.wrapper}>

      {/* ── Sender block ─────────────────────────── */}
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          Sender Account
        </div>
        <div className={styles.grid2}>
          <div className={styles.field}>
            <label className={styles.label}>Gmail Address</label>
            <input className={`field-input ${errors.email ? styles.err : ''}`}
              type="email" placeholder="you@gmail.com" autoComplete="off"
              value={senderEmail} onChange={e => setSenderEmail(e.target.value)} />
            {errors.email && <span className={styles.errMsg}>{errors.email}</span>}
          </div>
          <div className={styles.field}>
            <label className={styles.label}>App Password</label>
            <div className={styles.pwdWrap}>
              <input className={`field-input ${errors.pwd ? styles.err : ''}`}
                type={showPwd ? 'text' : 'password'} placeholder="xxxx xxxx xxxx xxxx"
                autoComplete="new-password"
                value={senderPassword} onChange={e => setSenderPassword(e.target.value)}
                style={{ paddingRight: 42 }} />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPwd(v => !v)}>
                {showPwd
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {errors.pwd && <span className={styles.errMsg}>{errors.pwd}</span>}
            <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className={styles.link}>
              Get App Password from Google →
            </a>
          </div>
        </div>
      </div>

      {/* ── Compose block ────────────────────────── */}
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
          </svg>
          Compose Message
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Subject</label>
          <input className={`field-input ${errors.subject ? styles.err : ''}`}
            type="text" placeholder="e.g. Exciting opportunity for you"
            value={subject} onChange={e => setSubject(e.target.value)} />
          {errors.subject && <span className={styles.errMsg}>{errors.subject}</span>}
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label className={styles.label}>Message</label>
            <span className={styles.hint}>Use <code>{'{{Name}}'}</code> to personalize</span>
          </div>
          <textarea className={`field-input ${styles.textarea} ${errors.body ? styles.err : ''}`}
            placeholder={`Hi {{Name}},\n\nI wanted to reach out about…`}
            value={body} onChange={e => setBody(e.target.value)} rows={7} />
          {errors.body && <span className={styles.errMsg}>{errors.body}</span>}
        </div>
      </div>

      {/* ── Outreach Config block ────────────────── */}
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 005 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          Outreach Safeguards & AI
        </div>
        <div className={styles.configList}>
          <label className={styles.configLabel}>
            <input
              type="checkbox"
              className={styles.configCheckbox}
              checked={enableSafeMode}
              onChange={e => setEnableSafeMode(e.target.checked)}
            />
            <div>
              <span className={styles.configTitle}>Google Rate Limit Guard (Safe Mode)</span>
              <span className={styles.configDesc}>Auto-throttles sends (45-180s delay), caps daily sends at 380, and groups recruiter domains to prevent domain blacklisting.</span>
            </div>
          </label>

          <label className={styles.configLabel}>
            <input
              type="checkbox"
              className={styles.configCheckbox}
              checked={enableAISpintax}
              onChange={e => setEnableAISpintax(e.target.checked)}
            />
            <div>
              <span className={styles.configTitle}>AI Content Spintax</span>
              <span className={styles.configDesc}>Automatically generates unique text variations of your message template for each recruiter to bypass spam fingerprinting filters.</span>
            </div>
          </label>

          {enableAISpintax && (
            <div className={styles.field} style={{ paddingLeft: 28, marginTop: 4 }}>
              <label className={styles.label}>Gemini API Key</label>
              <div className={styles.pwdWrap}>
                <input
                  className={`field-input ${errors.apiKey ? styles.err : ''}`}
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="AI Key (saved to account)"
                  value={geminiApiKey}
                  onChange={e => setGeminiApiKey(e.target.value)}
                  style={{ paddingRight: 42 }}
                />
                <button type="button" className={styles.eyeBtn} onClick={() => setShowApiKey(v => !v)}>
                  {showApiKey
                    ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              {errors.apiKey && <span className={styles.errMsg}>{errors.apiKey}</span>}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className={styles.link}>
                Get free Gemini API Key from Google AI Studio →
              </a>
            </div>
          )}
        </div>
      </div>

      {/* ── Attachments block ────────────────────── */}
      <div className={styles.block}>
        <div className={styles.blockHeader}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
          Attachments
          <span className={styles.reqTag} style={{ color: 'var(--error)', border: '1px solid rgba(248,113,113,0.3)', background: 'var(--error-bg)', fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px', marginLeft: '6px' }}>required</span>
        </div>
        <div className={styles.attachRow}>
          <button type="button" className="btn-ghost" style={{ fontSize: '0.85rem' }}
            onClick={() => (document.getElementById('_att') as HTMLInputElement)?.click()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Attach files
          </button>
          <input id="_att" type="file" multiple style={{ display: 'none' }} onChange={handleFiles} />
          {attachments.length > 0 && (
            <span className={styles.attachCount}>{attachments.length} file{attachments.length > 1 ? 's' : ''} attached</span>
          )}
        </div>
        {errors.attachments && <span className={styles.errMsg} style={{ display: 'block', marginTop: '6px' }}>{errors.attachments}</span>}
        {attachments.length > 0 && (
          <div className={styles.attachList}>
            {attachments.map((f, i) => (
              <div key={i} className={styles.attachItem}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>{f.name}</span>
                <button type="button" className={styles.removeAttach} onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Actions ──────────────────────────────── */}
      <div className={styles.actions}>
        <button className="btn-ghost" onClick={onBack}>← Back</button>
        <button className="btn-primary" onClick={submit}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Send to {contactCount} contacts
        </button>
      </div>
    </div>
  );
}
