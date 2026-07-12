# JobScrape — Automated Job Search & Recruiter Outreach

> Find real job listings, extract recruiter contacts, and launch automated email campaigns — all from one dashboard.

<img width="1919" height="1014" alt="image" src="https://github.com/user-attachments/assets/bf2f420e-d9f1-4e72-b30a-0c1f25f7d42c" />


---

## How It Works

1. **Search Jobs** — Enter a job title and location. The app fetches live listings from a job search API and displays them in a sortable, filterable table.
2. **View Job Details** — Click any job to see a detailed breakdown (tech stack, experience required, summary). The app uses a headless Chrome browser to open the real job page, bypass Cloudflare protection, extract the raw text, and let AI structure it into clean fields.
3. **Upload Files** — Drop a CSV, XLSX, PDF, or DOCX file and the app extracts recruiter names, emails, and companies using AI. Great for importing your existing contact lists.
4. **Generate Contacts from Jobs** — Select the jobs you're interested in. The app uses AI to find each company's real domain, then generates likely recruiter email patterns (e.g. `firstname.lastname@company.com`).
5. **Launch Campaigns** — Pick your contacts, write a campaign, and send automated emails. The system tracks opens, replies, and bounces, and automatically pauses after hitting a daily limit per company to avoid spamming.

---

## Features

| Feature | Detail |
|---|---|
| **Job Search** | Live listings with filters (location, contract type, seniority, posted date). Client-side search bar to filter results instantly. |
| **Job Description Scraper** | Headless Chrome resolves redirect chains (302 → JS redirects → Cloudflare-protected pages) and extracts clean text. AI parses tech stack, experience requirements, and summary. |
| **AI Email Guessing** | Gemini AI finds company domains + common email patterns. Generates realistic recruiter emails without fabricating fake addresses. |
| **File Upload & Parsing** | Upload CSV, XLSX, PDF, or DOCX files.extracts names, emails, and companies from any format. Parser will pull the email form there.
| **Email Campaigns** | Bulk send with tracking. Auto-pauses at a configurable limit per company. Retry failed sends. |
| **Contacts Preview** | See all generated contacts, swap alternative email suggestions, review before launching. |

![Job Search Results]<img width="1919" height="1016" alt="image" src="https://github.com/user-attachments/assets/46b3b385-c279-4162-9bdc-2294f6ddbe94" />


![Job Description Modal]<img width="1919" height="1018" alt="image" src="https://github.com/user-attachments/assets/3ed07e56-91ba-4563-a664-6e258c60c4da" />


![Contacts Preview]<img width="1919" height="1015" alt="image" src="https://github.com/user-attachments/assets/e42d6c8b-d96a-4c8d-9e23-e2a2b8e77b75" />


---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript |
| **Styling** | CSS Modules |
| **Database** | SQLite (via `better-sqlite3`) |
| **AI** | Google Gemini API |
| **Browser Automation** | Puppeteer (headless Chrome) |
| **Email** | Nodemailer (SMTP) |
| **Auth** | Custom session-based (Next.js API routes) |
| **Content Extraction** | linkedom (server-side HTML parsing) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Google Chrome or Edge (for Puppeteer)
- A [Google Gemini API key](https://aistudio.google.com/apikey)
- A job search API key (free tier available)
- SMTP credentials for sending emails

### Environment Variables

Create a `.env` file in the project root:

```env
# Job Search API credentials
ADZUNA_APP_ID=your_app_id
ADZUNA_API_KEY=your_api_key

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# SMTP for sending campaigns
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Session secret for auth
SESSION_SECRET=your_random_secret_here
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

---

## Project Structure

```
app/
  api/
    jobs/
      search      — Fetch job listings
      describe    — Scrape job page with headless Chrome + AI extraction
      convert     — Generate recruiter contacts from selected jobs
    campaigns/    — CRUD + send/stop/resume campaign workflows
    auth/         — Login/logout/session
    send/         — Send individual emails
    parse/        — Parse uploaded contact files
  page.tsx        — Main dashboard (login, search, campaign tabs)
  login/          — Login page
components/
  JobSearch.tsx       — Search form, results table, filters
  JobDetailModal.tsx  — Job description modal with scraped data
  ContactsPreview.tsx — Email review with swap suggestions
  CampaignModal.tsx   — Campaign creation & management
  ProgressDashboard   — Campaign tracking dashboard
  LoginForm.tsx       — Auth UI
lib/
  emailGuesser.ts     — Pattern-based email generation
  emailGuesserAI.ts   — AI domain discovery + pattern matching
  textExtractor.ts    — Pure JS HTML content extractor (strip noise, keep body content)
  jobApis.ts          — Job search API client
  db.ts               — SQLite database helpers
  ai.ts               — Gemini AI client wrapper
outreach.db           — SQLite database (created at runtime)
```

---

## How the Job Description Scraper Works

1. User clicks "See Job Description" on a job listing
2. Server launches a headless Chrome browser via Puppeteer
3. Chrome navigates to the job URL — follows all HTTP redirects (302) and JavaScript redirects (`location.replace`, `navigateTo()`) automatically
4. If the site uses Cloudflare, Chrome executes the JS challenge just like a real browser
5. After the page fully loads, the raw HTML is extracted
6. A pure JS content extractor strips scripts, styles, nav bars, footers — keeping only headings, lists, paragraphs, and table cells from the `<body>`
7. The clean text is sent to Google Gemini AI which returns structured JSON:
   - **Skills & Tech Stack** (list of technologies)
   - **Experience** (exact years mentioned)
   - **Summary** (concise role overview)
   - **Additional Info** (education, benefits, remote policy)
8. The response is displayed in a modal with the source badge ("Page scraped" vs "API description" vs "Blocked by Cloudflare")



---

## How Email Guessing Works

1. For each selected job, the app sends the company name + industry to Gemini AI
2. AI finds the **real company domain** (not a made-up one) and suggests **known email patterns** (e.g. `{first}.{last}@domain.com`, `{first}@domain.com`)
3. The app generates candidate emails and presents them in the Contacts Preview
4. Users can review, swap between alternatives (dropdown picker), and remove bad guesses
5. Selected contacts are saved to the campaign

---

## License

MIT
