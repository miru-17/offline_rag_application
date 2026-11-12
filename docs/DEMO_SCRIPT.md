# RAGENTIS – Demo video script

Demo company: **Velvizhi Engineering Pvt. Ltd.**, an auto-components manufacturer in
Coimbatore. The company and everything in its documents are **fictional** and made
for this demo. Every document says so in its footer.

Length: about 12–15 minutes. Record at 1920×1080 with the browser zoomed to 90 %.

---

## 0. Before recording (once, about 10 minutes)

1. Start RAGENTIS: `docker compose up -d` → wait until `docker compose ps` shows 4 services running.
2. Sign in once at **https://localhost:8443** as your administrator. Install the licence if needed.
3. Load the demo data (in the project folder):
   ```
   backend\.venv\Scripts\python demo\seed_demo.py --admin <your admin user name>
   ```
   It asks for the admin password and then:
   - creates 4 demo users and the HR, Finance and Sales team spaces,
   - uploads 13 company documents (policies, invoices, a scanned invoice, contracts, spreadsheets),
   - creates a second contract version with a legal hold,
   - adds the sales register to the Data Dashboard,
   - runs an invoice extraction,
   - asks 9 sample questions so Insights has data,
   - creates a usage report.

   With the real AI model this takes 5–15 minutes. Running it again is safe.
4. Ask one question in the AI Workspace before recording. This loads the AI model, so the first answer in the video is fast.
5. Open these in separate browser windows (normal + private/incognito), each signed in:
   - window 1: your **admin**
   - window 2: **fin.arun** / `Velvizhi@2026`
   - window 3: **emp.divya** / `Velvizhi@2026`

| User | Password | Role | Team | Who |
| --- | --- | --- | --- | --- |
| (your admin) | (yours) | Admin | all | IT administrator |
| hr.priya | Velvizhi@2026 | User | HR | HR Executive |
| fin.arun | Velvizhi@2026 | User | Finance | Accounts Manager |
| sales.karthik | Velvizhi@2026 | User | Sales | Sales Engineer |
| emp.divya | Velvizhi@2026 | Viewer | – | Production Engineer (read-only) |

---

## 1. Introduction (1 min) – admin, Dashboard

> "Companies have their knowledge in hundreds of PDFs, Word and Excel files.
> Sending them to a public AI service is not allowed for confidential data.
> RAGENTIS is a private AI assistant that runs completely offline on the company's
> own computer. It answers only from the company's documents, shows the evidence for
> every answer, and enforces who may see what."

Show the Dashboard. Point at the organisation name at the top and **Model ready – llama3.2:3b** at the bottom left.

## 2. Documents (1.5 min) – admin, Documents

- Show the list: policies, invoices, contracts, Excel files, the scanned invoice ("Image (read with OCR)").
- Point at the sharing labels: *Organisation*, *Team space · HR*, *Team space · Finance*, and *PII redacted*.
- Click **Vendor_Contract_Steelmark_v2.pdf**: version 2 with version 1 in the history, and **Legal hold** on.

> "Files can be private, shared with a team, or with the whole company. When a
> contract is renewed, the new version replaces the old one for answers, and the
> history is kept."

## 3. Asking questions (3 min) – AI Workspace

Ask these questions one by one:

| Question | Expected answer |
| --- | --- |
| What is the hotel limit for a G4 engineer in a metro city? | Rs 5,000 per night (other cities Rs 3,500) |
| Who approves international travel? | The Managing Director |
| Within how many hours must a lost laptop be reported? | Within 2 hours, to the IT helpdesk |
| What is the notice period for a G5 Senior Engineer? | 60 days |

After the first answer:
- point out that the answer **streams word by word**;
- click **View evidence**: file, page, match score and the exact passage;
- click **Open at page 1**: the original PDF opens at that page.

Then show the two safety checks:

| Question | Expected behaviour |
| --- | --- |
| What is the capital of France? | Refuses: "not in your uploaded documents" (no general knowledge) |
| What is the CEO's salary? | Refuses: not in the documents, so nothing is invented |

> "Every answer comes only from the company's documents, and you can always check the source."

## 4. Who sees what (1.5 min) – Divya (viewer) and Priya (HR)

1. Window 3, **emp.divya**: Documents shows only the 4 company-wide files. There is no upload button (view-only).
2. Ask: *How many earned leave days can be carried forward?* → not in her documents, because the leave policy belongs to the HR team.
3. Sign in as **hr.priya** (or use another window) and ask the same question → **9 days**, with the HR leave policy as evidence.

> "Access control works inside the AI too: the assistant never uses a document the person is not allowed to open."

## 5. Finance: scanned invoice, extraction, privacy (2 min) – fin.arun

1. Ask: *What is the total amount on invoice INV-2026-0503 from Annai Logistics?* → **Rs 99,120**. This invoice is a **photo** of a paper invoice, read with OCR.
2. Ask: *What is the total amount of invoice INV-2026-0417?* → **Rs 523,094.00** (EN8 steel from Steelmark Alloys, including 18 % GST).
3. **Extraction** page → *Vendor invoices Sep-Oct 2026* → a table of invoice number, date, vendor, total and GSTIN from 5 invoices → **Open in Data Dashboard** / **Export CSV**.
4. Privacy: as **hr.priya**, ask *What is the PAN and mobile number of employee VE1003?* → the AI never sees these values; they are redacted (Settings → Personal data → Redact).

## 6. Compare contract versions (1 min) – admin

Documents → contract v2 → in Version history click the **compare** icon next to v1 (or open **Compare** and choose v1 and v2).

Expected: the agreement period ends 2028 instead of 2027, delivery within 10 days instead of 14, payment terms 30 days instead of 45, a late-delivery penalty of 2 % instead of 1 %, higher prices, and a new quarterly price review. The AI summary lists the changes.

## 7. Data Dashboard (1.5 min) – admin or sales.karthik

Data Dashboard → **Sales_Register_FY2026-27.xlsx** (453 sales invoices, April–October 2026):
- KPI tiles and the monthly trend;
- **Ask the data**: *total amount by region*, *top 5 products by amount*, *monthly sales trend*;
- **Export** the result as CSV.

Also: Documents → *Employee_Handbook_2026.docx* → **Find tables for the Data Dashboard** → the grades table opens as a dashboard.

## 8. Watched folder (45 s)

Copy `demo\watch-sample\Canteen_Menu_November_2026.pdf` into the project's `watch` folder. Within about a minute it appears in Documents with the label *Watched folder*. Then ask: *What is the canteen lunch price?* → **Rs 30 per meal**.

> "Departments can drop files into a shared folder. RAGENTIS picks them up automatically."

## 9. Administration and security (2 min) – admin

- **Insights**: questions per day, answer rate, 👍/👎 feedback, **knowledge gaps** (questions the documents could not answer, without who asked), system health.
- **Reports**: download the PDF usage report (it is also created every week).
- **Audit log**: sign-ins, uploads, legal hold, team changes; export CSV.
- **Users & roles**: roles, reset password, unlock an account. Optional: sign in 5 times with a wrong password as sales.karthik → locked → **Unlock account**.
- **Settings**: two-step login (QR code), answer language, AI model, data retention.
- **License**: signed licence, days left, the **installation ID** that ties the licence to this server, and the licence history.

## 10. Closing (30 s)

> "RAGENTIS runs fully offline. It answers with evidence and respects permissions.
> It also covers what companies need in production: audit, retention, encrypted
> backups, two-step login, Active Directory and licence control. It installs from
> an offline package with one command."

---

### Tips

- Answers take 5–30 seconds on a laptop CPU. Cut the waiting in editing, or say what is happening while it streams.
- If an answer is slightly different from the table above, that is normal for an AI model. The evidence panel shows the exact text.
- To start over, delete the demo users and documents in the app and run the seed script again. Never use `docker compose down -v`: it deletes all data.
