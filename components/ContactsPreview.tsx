'use client';

import { useState } from 'react';
import styles from './ContactsPreview.module.css';

interface Contact {
  name: string;
  email: string;
  company?: string;
  suggestedEmails?: string;
  aiSource?: string;
}

interface Props {
  contacts: Contact[];
  filename: string;
  onConfirm: (contacts: Contact[]) => void;
  onBack: () => void;
}

export default function ContactsPreview({ contacts, filename, onConfirm, onBack }: Props) {
  const [rows, setRows] = useState<Contact[]>(contacts);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<Set<string>>(() => new Set(contacts.map(c => c.email)));

  const [pickingEmail, setPickingEmail] = useState<string | null>(null);

  const filtered = rows.filter(
    (c) =>
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.company && c.company.toLowerCase().includes(search.toLowerCase()))
  );

  const toggle = (email: string) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(email)) s.delete(email);
      else s.add(email);
      return s;
    });
  };

  const toggleAll = () => {
    const allFilteredSelected = filtered.every((c) => selected.has(c.email));
    setSelected((prev) => {
      const s = new Set(prev);
      filtered.forEach((c) => {
        if (allFilteredSelected) s.delete(c.email);
        else s.add(c.email);
      });
      return s;
    });
  };

  const deleteSelected = () => {
    setRows((r) => r.filter((c) => !selected.has(c.email)));
    setSelected((prev) => {
      const s = new Set(prev);
      rows.forEach((c) => {
        if (s.has(c.email)) s.delete(c.email);
      });
      return s;
    });
  };

  const changeEmail = (oldEmail: string, newEmail: string) => {
    setRows((r) =>
      r.map((c) => {
        if (c.email === oldEmail) {
          setSelected((prev) => {
            const s = new Set(prev);
            s.delete(oldEmail);
            s.add(newEmail);
            return s;
          });
          return { ...c, email: newEmail };
        }
        return c;
      })
    );
    setPickingEmail(null);
  };

  const handleConfirm = () => {
    const toConfirm = rows.filter((c) => selected.has(c.email));
    onConfirm(toConfirm);
  };

  const filteredSelectedCount = filtered.filter((c) => selected.has(c.email)).length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Search contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {selected.size > 0 && (
          <button className={styles.removeBtn} onClick={deleteSelected}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
            </svg>
            Delete {selected.size} Selected
          </button>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.chkTh}>
                <input
                  type="checkbox"
                  className={styles.chk}
                  checked={filtered.length > 0 && filtered.every((c) => selected.has(c.email))}
                  onChange={toggleAll}
                />
              </th>
              <th className={styles.numTh}>#</th>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>AI Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => {
              const isChecked = selected.has(c.email);
              const suggestions = c.suggestedEmails
                ? c.suggestedEmails.split(',').map((s) => s.trim()).filter(Boolean)
                : [];
              const isPicking = pickingEmail === c.email;
              return (
                <tr
                  key={c.email + c.name}
                  className={`${styles.row} ${isChecked ? styles.selected : ''}`}
                  onClick={() => !isPicking && toggle(c.email)}
                >
                  <td className={styles.chkTd}>
                    <input
                      type="checkbox"
                      className={styles.chk}
                      checked={isChecked}
                      onChange={() => toggle(c.email)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className={styles.num}>{i + 1}</td>
                  <td className={styles.nameCell}>{c.name || <span className={styles.empty}>—</span>}</td>
                  <td className={styles.companyCell}>{c.company || <span className={styles.empty}>—</span>}</td>
                  <td>
                    <div className={styles.emailCell} onClick={(e) => e.stopPropagation()}>
                      <span className={styles.emailTag}>{c.email}</span>
                      {suggestions.length > 1 && (
                        <button
                          className={styles.switchEmailBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPickingEmail(isPicking ? null : c.email);
                          }}
                          title="Try alternative email"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M1 4v6h6M23 20v-6h-6" />
                            <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
                          </svg>
                        </button>
                      )}
                      {isPicking && (
                        <div className={styles.emailPicker}>
                          <div className={styles.pickerArrow} />
                          {suggestions.map((altEmail) => (
                            <button
                              key={altEmail}
                              className={`${styles.pickerOption} ${altEmail === c.email ? styles.pickerOptionActive : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (altEmail !== c.email) changeEmail(c.email, altEmail);
                                else setPickingEmail(null);
                              }}
                            >
                              {altEmail}
                              {altEmail === c.email && <span className={styles.pickerCheck}>✓</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    {c.aiSource ? (
                      <span className={`${styles.sourceBadge} ${c.aiSource === 'pattern' ? styles.sourcePattern : ''}`}>
                        {c.aiSource === 'pattern' ? 'pattern' : 'AI'}
                      </span>
                    ) : (
                      <span className={styles.empty}>—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!filtered.length && (
              <tr>
                <td colSpan={6} className={styles.noResults}>
                  No contacts match &ldquo;{search}&rdquo;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.footer}>
        <button className="btn-ghost" onClick={onBack}>
          ← Back
        </button>
        <button className="btn-primary" onClick={handleConfirm} disabled={selected.size === 0}>
          Continue with {selected.size} contacts
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
