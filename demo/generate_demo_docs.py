"""
Generates the demo documents for the FICTIONAL company "Velvizhi Engineering
Pvt. Ltd." used in RAGENTIS demos. Every name, number and address is invented.
Run (needs fpdf2, python-docx, openpyxl, pillow):  python demo/generate_demo_docs.py
"""
import datetime as dt
import random
from pathlib import Path

import docx
import openpyxl
from docx.shared import Pt
from fpdf import FPDF
from openpyxl.styles import Font, PatternFill
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = Path(__file__).resolve().parent / "documents"
WATCH = Path(__file__).resolve().parent / "watch-sample"
COMPANY = "Velvizhi Engineering Pvt. Ltd."
ADDRESS = "Plot 14, Industrial Estate, Coimbatore 641021, Tamil Nadu"
FOOTER = "Fictional company created for software demonstration. All data is invented."
random.seed(2026)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


class Doc(FPDF):
    def __init__(self, title, ref):
        super().__init__(format="A4")
        self.title_text, self.ref = title, ref
        self.add_font("D", "", FONT)
        self.add_font("D", "B", FONT_B)
        self.set_auto_page_break(True, 18)
        self.add_page()

    def header(self):
        self.set_fill_color(18, 64, 112)
        self.rect(0, 0, 210, 16, "F")
        self.set_text_color(255, 255, 255)
        self.set_font("D", "B", 11)
        self.set_xy(12, 4)
        self.cell(0, 8, COMPANY)
        self.set_font("D", "", 8)
        self.set_xy(-82, 4)
        self.cell(70, 8, self.ref, align="R")
        self.set_text_color(0, 0, 0)
        self.set_y(22)

    def footer(self):
        self.set_y(-12)
        self.set_font("D", "", 7)
        self.set_text_color(120, 120, 120)
        self.cell(0, 5, f"{FOOTER}   Page {self.page_no()}", align="C")
        self.set_text_color(0, 0, 0)

    def h1(self, text):
        self.set_font("D", "B", 16)
        self.multi_cell(0, 9, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def h2(self, text):
        self.ln(2)
        self.set_font("D", "B", 12)
        self.set_text_color(18, 64, 112)
        self.multi_cell(0, 7, text, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)

    def p(self, text, size=10):
        self.set_font("D", "", size)
        self.multi_cell(0, 5.6, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def bullets(self, items):
        self.set_font("D", "", 10)
        for item in items:
            self.multi_cell(0, 5.6, "•  " + item, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def table(self, header, rows, widths):
        self.set_font("D", "B", 9)
        self.set_fill_color(225, 234, 245)
        for h, w in zip(header, widths):
            self.cell(w, 7, h, border=1, fill=True)
        self.ln()
        self.set_font("D", "", 9)
        for row in rows:
            for v, w in zip(row, widths):
                self.cell(w, 6.5, str(v), border=1)
            self.ln()
        self.ln(2)

    def meta(self, lines):
        self.set_font("D", "", 8.5)
        self.set_text_color(90, 90, 90)
        for line in lines:
            self.cell(0, 5, line, new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0, 0, 0)
        self.ln(2)


def save(pdf, name, folder=OUT):
    folder.mkdir(parents=True, exist_ok=True)
    pdf.output(str(folder / name))


# ---------------------------------------------------------------- HR leave policy
def leave_policy():
    d = Doc("Leave Policy", "HR-POL-004 | Rev 3 | Effective 1 April 2026")
    d.h1("Leave Policy 2026-27")
    d.meta(["Owner: Human Resources", "Approved by: Board of Directors, 18 March 2026", "Applies to: all permanent employees"])
    d.h2("1. Purpose")
    d.p("This policy explains the types of leave available to employees of Velvizhi Engineering, how leave is "
        "applied for and approved, and how unused leave is treated at the end of the leave year (April to March).")
    d.h2("2. Leave entitlement")
    d.table(["Type of leave", "Days per year", "Carry forward", "Notes"], [
        ["Earned / annual leave", "18", "Up to 9 days", "Credited 1.5 days per month"],
        ["Sick leave", "12", "No", "Medical certificate if more than 2 days"],
        ["Casual leave", "6", "No", "Max 2 days at a time"],
        ["Maternity leave", "26 weeks", "-", "As per Maternity Benefit Act"],
        ["Paternity leave", "10", "No", "Within 3 months of birth"],
        ["Bereavement leave", "5", "No", "Immediate family"],
    ], [52, 30, 34, 70])
    d.h2("3. Applying for leave")
    d.bullets([
        "Earned leave must be applied at least 7 working days in advance through the HR portal.",
        "Leave of more than 5 consecutive days needs approval from the department head.",
        "Sick leave can be applied on the day of absence; inform the reporting manager before 10:00 am.",
        "During the annual plant shutdown (26-31 December) employees use earned leave unless posted on maintenance duty.",
    ])
    d.h2("4. Encashment and carry forward")
    d.p("A maximum of 9 unused earned-leave days is carried forward to the next leave year. Earned leave above this "
        "limit is encashed at the basic salary rate in the April payroll. On resignation, a maximum of 30 accumulated "
        "earned-leave days is encashed with the full and final settlement.")
    d.add_page()
    d.h2("5. Holidays 2026-27")
    d.table(["Date", "Holiday"], [
        ["14 April 2026", "Tamil New Year"], ["1 May 2026", "May Day"], ["15 August 2026", "Independence Day"],
        ["2 October 2026", "Gandhi Jayanti"], ["20 October 2026", "Ayudha Pooja"], ["8 November 2026", "Deepavali"],
        ["25 December 2026", "Christmas"], ["15 January 2027", "Pongal"], ["16 January 2027", "Thiruvalluvar Day"],
        ["26 January 2027", "Republic Day"],
    ], [50, 120])
    d.h2("6. Contacts")
    d.p("Questions about leave: HR helpdesk, extension 2104, or hr.helpdesk@velvizhi.example.")
    save(d, "HR_Leave_Policy_2026.pdf")


# ---------------------------------------------------------------- Travel policy
def travel_policy():
    d = Doc("Travel Policy", "FIN-POL-011 | Rev 5 | Effective 1 June 2026")
    d.h1("Travel and Expense Policy")
    d.meta(["Owner: Finance", "Applies to: all employees travelling on company work"])
    d.h2("1. Hotel limits per night (including taxes)")
    d.table(["Grade", "Metro cities", "Other cities", "Daily allowance"], [
        ["G1 - G3 (Associates)", "Rs 3,500", "Rs 2,500", "Rs 600"],
        ["G4 - G5 (Engineers, Executives)", "Rs 5,000", "Rs 3,500", "Rs 800"],
        ["G6 - G7 (Managers)", "Rs 7,500", "Rs 5,000", "Rs 1,200"],
        ["G8 and above (Senior management)", "Actuals", "Actuals", "Rs 2,000"],
    ], [70, 35, 35, 40])
    d.p("Metro cities: Chennai, Bengaluru, Mumbai, Delhi NCR, Hyderabad, Kolkata and Pune.")
    d.h2("2. Mode of travel")
    d.bullets([
        "Flights: economy class for all grades; book at least 14 days in advance where possible.",
        "Trains: 2nd AC for G1-G5, 1st AC for G6 and above.",
        "Local travel: app-based cabs; own vehicle reimbursed at Rs 12 per km (car) and Rs 5 per km (two-wheeler).",
    ])
    d.h2("3. Claims")
    d.bullets([
        "Submit the expense claim with original bills within 30 days of returning.",
        "Claims above Rs 25,000 need approval of the department head and the Finance controller.",
        "Advances must be settled within 15 days; unsettled advances are recovered from salary.",
        "Alcohol, fines, personal entertainment and laundry for trips under 4 days are not reimbursed.",
    ])
    d.h2("4. International travel")
    d.p("International travel needs approval from the Managing Director. A daily allowance of USD 60 applies; "
        "travel insurance is arranged by the Admin department.")
    save(d, "Travel_and_Expense_Policy.pdf")


# ---------------------------------------------------------------- IT security policy
def it_policy():
    d = Doc("IT Security Policy", "IT-POL-002 | Rev 2 | Effective 1 July 2026")
    d.h1("Information Security Policy")
    d.meta(["Owner: IT Department", "Classification: Internal"])
    d.h2("1. Passwords and sign-in")
    d.bullets([
        "Passwords must have at least 12 characters and are changed every 180 days.",
        "Two-step login is mandatory for email, VPN and the ERP system.",
        "Accounts are locked after 5 wrong passwords; contact the IT helpdesk (extension 2200) to unlock.",
    ])
    d.h2("2. Laptops and data")
    d.bullets([
        "All laptops use BitLocker disk encryption and lock the screen after 5 minutes.",
        "Customer drawings may not be copied to USB drives or personal cloud storage.",
        "Confidential documents are shared only through the company document system.",
    ])
    d.h2("3. Reporting incidents")
    d.p("Suspected phishing e-mails, lost laptops or any data leak must be reported to the IT helpdesk within "
        "2 hours of discovery. The IT manager informs management and, where required, CERT-In within 6 hours.")
    d.h2("4. Backups")
    d.p("Servers are backed up every night at 23:00. Backups are encrypted and kept for 30 days; a restore test is "
        "done every quarter.")
    save(d, "IT_Security_Policy.pdf")


# ---------------------------------------------------------------- vendor contract v1 / v2
def contract(version):
    v2 = version == 2
    d = Doc("Supply Agreement", f"PUR-CON-2026-018 | Version {version}.0 | {'12 September' if v2 else '3 March'} 2026")
    d.h1("Raw Material Supply Agreement")
    d.meta(["Between: Velvizhi Engineering Pvt. Ltd. (Buyer)",
            "and: Steelmark Alloys Pvt. Ltd. (Supplier) - fictional",
            f"Agreement period: 1 April 2026 to 31 March {'2028' if v2 else '2027'}"])
    d.h2("1. Scope")
    d.p("The Supplier shall supply EN8 and EN19 alloy steel round bars as per the purchase orders issued by the Buyer, "
        "with mill test certificates for every heat number.")
    d.h2("2. Price")
    d.p(f"EN8 bars: Rs {'71,500' if v2 else '68,000'} per tonne. EN19 bars: Rs {'94,000' if v2 else '89,500'} per tonne. "
        "Prices exclude GST and are fixed for the agreement period"
        + (", subject to a quarterly review if the steel index changes by more than 5%." if v2 else "."))
    d.h2("3. Delivery")
    d.p(f"Delivery within {'10' if v2 else '14'} days of the purchase order at the Buyer's Coimbatore plant. "
        f"Late delivery attracts a penalty of {'2%' if v2 else '1%'} of the order value per week, up to 10%.")
    d.h2("4. Payment terms")
    d.p(f"Payment within {'30' if v2 else '45'} days of receipt of material and a valid tax invoice.")
    d.h2("5. Quality")
    d.p("Rejected material is replaced within 7 days at the Supplier's cost. Repeated rejection (3 lots in a quarter) "
        "allows the Buyer to terminate the agreement with 30 days notice.")
    d.h2("6. Signatures")
    d.p("For the Buyer: S. Meenakshi, Head - Procurement.    For the Supplier: R. Balaji, Director - Sales.")
    save(d, f"Vendor_Contract_Steelmark_v{version}.pdf")


# ---------------------------------------------------------------- invoices
VENDORS = [
    ("Steelmark Alloys Pvt. Ltd.", "33AAACS1234A1Z5", "EN8 round bar 40 mm", 6.2, 71500),
    ("Kovai Tooling Works", "33AABCK5678B1Z2", "Carbide inserts CNMG 120408", 400, 385),
    ("Southern Packaging Co.", "33AADCS9012C1Z9", "Corrugated boxes 5-ply", 1200, 42),
    ("Annai Logistics", "33AAFCA3456D1Z1", "Freight Coimbatore - Chennai (FTL)", 3, 18500),
]


def invoice(number, date, vendor):
    name, gstin, item, qty, rate = vendor
    d = Doc("Tax Invoice", f"Invoice {number}")
    d.h1("TAX INVOICE")
    d.meta([f"Supplier: {name}", f"Supplier GSTIN: {gstin}", f"Invoice number: {number}",
            f"Invoice date: {date:%d %B %Y}", f"Bill to: {COMPANY}, {ADDRESS}", "Buyer GSTIN: 33AAACV7788E1Z3"])
    amount = round(qty * rate, 2)
    gst = round(amount * 0.18, 2)
    total = amount + gst
    d.table(["Description", "Qty", "Rate (Rs)", "Amount (Rs)"],
            [[item, f"{qty:g}", f"{rate:,.2f}", f"{amount:,.2f}"]], [90, 25, 35, 35])
    d.table(["", "Amount (Rs)"], [["Taxable value", f"{amount:,.2f}"], ["IGST 18%", f"{gst:,.2f}"],
                                  ["Total amount", f"{total:,.2f}"]], [80, 50])
    d.p(f"Total amount payable: Rs {total:,.2f}. Payment due within 30 days. Bank: Demo Bank, IFSC DEMO0001234.")
    save(d, f"Invoice_{number}.pdf")
    return number, date, name, total


def scanned_invoice():
    """A photographed paper invoice (for OCR)."""
    img = Image.new("RGB", (1700, 2200), (248, 246, 240))
    draw = ImageDraw.Draw(img)
    big, mid, small = ImageFont.truetype(FONT_B, 64), ImageFont.truetype(FONT, 42), ImageFont.truetype(FONT, 36)
    y = 120
    draw.text((120, y), "Annai Logistics", font=big, fill=(20, 20, 20)); y += 110
    draw.text((120, y), "TAX INVOICE   No: INV-2026-0503", font=mid, fill=(20, 20, 20)); y += 80
    draw.text((120, y), "Date: 28 October 2026", font=mid, fill=(20, 20, 20)); y += 80
    draw.text((120, y), "Bill to: Velvizhi Engineering Pvt Ltd", font=mid, fill=(20, 20, 20)); y += 120
    for line in ["Freight Coimbatore to Pune, 2 trucks", "Rate per truck: Rs 42,000", "Taxable value: Rs 84,000",
                 "GST 18%: Rs 15,120", "Total amount: Rs 99,120", "", "Payment within 30 days",
                 "Fictional document for demonstration"]:
        draw.text((120, y), line, font=small, fill=(30, 30, 30)); y += 70
    img = img.rotate(1.2, expand=False, fillcolor=(248, 246, 240)).filter(ImageFilter.GaussianBlur(0.6))
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / "Scanned_Invoice_INV-2026-0503.png")


# ---------------------------------------------------------------- employee handbook (docx with tables)
def handbook():
    doc = docx.Document()
    style = doc.styles["Normal"]; style.font.name = "Calibri"; style.font.size = Pt(11)
    doc.add_heading(f"{COMPANY}", level=0)
    doc.add_heading("Employee Handbook 2026", level=1)
    doc.add_paragraph(FOOTER)
    doc.add_heading("Working hours", level=2)
    doc.add_paragraph("General shift: 9:00 am to 5:30 pm, Monday to Friday, and 9:00 am to 1:00 pm on the first and "
                      "third Saturday. Plant shifts: A 6:00-14:00, B 14:00-22:00, C 22:00-6:00. Office staff may work "
                      "from home 2 days a week with the manager's approval.")
    doc.add_heading("Grades and designations", level=2)
    t = doc.add_table(rows=1, cols=3); t.style = "Light Grid Accent 1"
    t.rows[0].cells[0].text, t.rows[0].cells[1].text, t.rows[0].cells[2].text = "Grade", "Designation", "Notice period (days)"
    for row in [("G1", "Trainee / Associate", "30"), ("G3", "Senior Associate", "30"), ("G4", "Engineer", "60"),
                ("G5", "Senior Engineer", "60"), ("G6", "Assistant Manager", "90"), ("G7", "Manager", "90"),
                ("G8", "General Manager", "90")]:
        c = t.add_row().cells
        for i, v in enumerate(row):
            c[i].text = v
    doc.add_heading("Code of conduct", level=2)
    for item in ["Safety shoes and helmets are mandatory on the shop floor.",
                 "Gifts from suppliers above Rs 2,000 must be declared to HR.",
                 "Harassment of any kind is reported to the Internal Committee (ic@velvizhi.example).",
                 "Mobile phones are not allowed near CNC machines."]:
        doc.add_paragraph(item, style="List Bullet")
    doc.add_heading("Benefits", level=2)
    t = doc.add_table(rows=1, cols=2); t.style = "Light Grid Accent 1"
    t.rows[0].cells[0].text, t.rows[0].cells[1].text = "Benefit", "Details"
    for row in [("Group health insurance", "Rs 5 lakh family floater"), ("Canteen", "Subsidised lunch at Rs 30"),
                ("Transport", "Company bus from Gandhipuram and Ukkadam"), ("Education", "Rs 25,000 per year for courses")]:
        c = t.add_row().cells; c[0].text, c[1].text = row
    OUT.mkdir(parents=True, exist_ok=True)
    doc.save(OUT / "Employee_Handbook_2026.docx")


def finance_summary():
    doc = docx.Document()
    doc.add_heading(f"{COMPANY} - Q2 FY2026-27 Finance Summary", level=1)
    doc.add_paragraph(FOOTER)
    doc.add_paragraph("Revenue grew 11% over Q1, mainly from the automotive segment. Raw material costs rose after the "
                      "steel price increase in August; the new Steelmark agreement fixes prices until March 2028.")
    t = doc.add_table(rows=1, cols=4); t.style = "Light Grid Accent 1"
    for i, h in enumerate(["Month", "Revenue", "Expenses", "Profit"]):
        t.rows[0].cells[i].text = h
    for row in [("2026-07-31", "4,82,50,000", "3,96,10,000", "86,40,000"), ("2026-08-31", "5,10,20,000", "4,31,70,000", "78,50,000"),
                ("2026-09-30", "5,36,80,000", "4,40,30,000", "96,50,000")]:
        c = t.add_row().cells
        for i, v in enumerate(row):
            c[i].text = v
    doc.add_paragraph("Receivables above 90 days: Rs 1.2 crore (3 customers). Cash and bank balance on 30 September "
                      "2026: Rs 6.4 crore.")
    doc.save(OUT / "Q2_FY2026-27_Finance_Summary.docx")


# ---------------------------------------------------------------- spreadsheets
REGIONS = ["Tamil Nadu", "Karnataka", "Maharashtra", "Gujarat", "Telangana"]
PRODUCTS = [("Gear shaft GS-40", 1850), ("Pump housing PH-12", 4200), ("Flange F-150", 960),
            ("Bearing cap BC-08", 640), ("Valve body VB-25", 3100)]
CUSTOMERS = ["Sundaram Motors (fictional)", "Kaveri Pumps (fictional)", "Deccan Auto Parts (fictional)",
             "Western Valves (fictional)", "Nila Agro Machines (fictional)", "Arasu Tractors (fictional)"]


def sales_register():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Sales"
    head = ["Invoice Date", "Invoice No", "Region", "Customer", "Product", "Units", "Unit Price (Rs)", "Amount (Rs)"]
    ws.append(head)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF"); c.fill = PatternFill("solid", fgColor="124070")
    start = dt.date(2026, 4, 1)
    n = 0
    for day in range(0, 214):
        date = start + dt.timedelta(days=day)
        if date.weekday() == 6:
            continue
        for _ in range(random.randint(1, 4)):
            n += 1
            product, price = random.choice(PRODUCTS)
            region = random.choices(REGIONS, weights=[5, 3, 3, 2, 2])[0]
            growth = 1 + day / 600
            units = int(random.randint(20, 220) * growth)
            ws.append([date, f"VE/S/{n:05d}", region, random.choice(CUSTOMERS), product, units, price, units * price])
    for col, width in zip("ABCDEFGH", [14, 14, 14, 30, 22, 8, 15, 15]):
        ws.column_dimensions[col].width = width
    for row in ws.iter_rows(min_row=2, min_col=1, max_col=1):
        row[0].number_format = "dd-mm-yyyy"
    wb.save(OUT / "Sales_Register_FY2026-27.xlsx")
    return n


def employee_master():
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "Employees"
    ws.append(["Emp ID", "Name", "Department", "Grade", "Joining Date", "PAN", "Mobile", "Email", "Bank IFSC"])
    first = ["Priya", "Arun", "Karthik", "Divya", "Meenakshi", "Rahul", "Sneha", "Vignesh", "Lakshmi", "Suresh",
             "Anitha", "Gokul", "Revathi", "Prakash", "Nandhini", "Hari"]
    last = ["Raman", "Kumar", "Subramani", "Natarajan", "Sundar", "Krishnan", "Balaji", "Murugan"]
    depts = ["Production", "Quality", "Finance", "HR", "Sales", "Purchase", "IT", "Maintenance"]
    for i in range(1, 41):
        name = f"{random.choice(first)} {random.choice(last)}"
        ws.append([f"VE{1000 + i}", name, random.choice(depts), f"G{random.randint(1, 7)}",
                   dt.date(2015 + random.randint(0, 11), random.randint(1, 12), random.randint(1, 28)),
                   f"AAAPV{i:04d}K", f"+91 90000 {i:05d}", f"{name.split()[0].lower()}.{i}@velvizhi.example",
                   "DEMO0001234"])
    wb.save(OUT / "Employee_Master_Confidential.xlsx")


def canteen_menu():
    d = Doc("Canteen menu", "ADM-NOTICE-112 | November 2026")
    d.h1("Canteen Menu - November 2026")
    d.table(["Day", "Lunch", "Snacks"], [["Monday", "Sambar rice, poriyal, curd", "Sundal"],
                                         ["Tuesday", "Veg biryani, raita", "Bajji"],
                                         ["Wednesday", "Chapati, kurma, rice", "Vadai"],
                                         ["Thursday", "Lemon rice, kootu, curd", "Biscuits"],
                                         ["Friday", "Meals with payasam", "Samosa"]], [30, 95, 50])
    d.p("Lunch is served from 12:30 pm to 2:00 pm. Price: Rs 30 per meal (subsidised).")
    save(d, "Canteen_Menu_November_2026.pdf", WATCH)


if __name__ == "__main__":
    leave_policy(); travel_policy(); it_policy(); contract(1); contract(2)
    rows = []
    for number, date, vendor in [("INV-2026-0417", dt.date(2026, 9, 4), VENDORS[0]),
                                 ("INV-2026-0452", dt.date(2026, 9, 19), VENDORS[1]),
                                 ("INV-2026-0478", dt.date(2026, 10, 7), VENDORS[2]),
                                 ("INV-2026-0489", dt.date(2026, 10, 15), VENDORS[3])]:
        rows.append(invoice(number, date, vendor))
    scanned_invoice(); handbook(); finance_summary()
    print("sales rows:", sales_register()); employee_master(); canteen_menu()
    for r in rows:
        print(r)
