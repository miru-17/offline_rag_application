# Demo data – Velvizhi Engineering Pvt. Ltd. (fictional)

Everything in this folder is invented for demonstrations: company, people, vendors,
customers, PAN numbers (`AAAPV0001K` …), phone numbers (`+91 90000 …`), e-mail
addresses (`@velvizhi.example`) and bank codes (`DEMO0001234`).

| File | Used to show |
| --- | --- |
| `documents/Travel_and_Expense_Policy.pdf` | Questions with evidence; open at the cited page |
| `documents/IT_Security_Policy.pdf` | Company-wide document |
| `documents/Employee_Handbook_2026.docx` | Word tables → Data Dashboard |
| `documents/HR_Leave_Policy_2026.pdf` | HR team space (hidden from others) |
| `documents/Employee_Master_Confidential.xlsx` | Personal data redaction |
| `documents/Invoice_INV-2026-04xx.pdf` (4) | Structured extraction |
| `documents/Scanned_Invoice_INV-2026-0503.png` | OCR of a photographed invoice |
| `documents/Q2_FY2026-27_Finance_Summary.docx` | Finance team space |
| `documents/Vendor_Contract_Steelmark_v1/v2.pdf` | Versions, compare, legal hold |
| `documents/Sales_Register_FY2026-27.xlsx` | Data Dashboard (453 invoices) |
| `watch-sample/Canteen_Menu_November_2026.pdf` | Watched folder |

Load everything into a running RAGENTIS:

```
backend\.venv\Scripts\python demo\seed_demo.py --admin <admin user name>
```

The seed script needs only Python, no extra packages. The video script is in
`docs/DEMO_SCRIPT.md`. To rebuild the documents, run
`python demo/generate_demo_docs.py` (needs fpdf2, python-docx, openpyxl and pillow).
