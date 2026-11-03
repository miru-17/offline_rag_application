"""
Checks for the security hardening (account lockout, HttpOnly session cookie,
single-use two-step codes, API docs off, search scoping, encrypted backups).
Start the API with ./reset.sh and LOGIN_RATE_LIMIT=1000/minute first.
"""
import os, subprocess, sys, time
import pyotp, requests

B = "http://127.0.0.1:8000"
H2 = os.environ.get("E2E_DIR", "/tmp/claude-0/harness2")
RUN = os.environ.get("E2E_RUN", "/tmp/claude-0/run2")
PY = os.environ.get("E2E_PYTHON", sys.executable)
COOKIE = "ragentis_session"
R = []


def check(name, ok, info=""):
    ok = bool(ok); R.append(ok)
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  | {str(info)[:250]}"))


def psql(q):
    return subprocess.run(["psql", "-h", "localhost", "-U", "postgres", "-d", "rag_app", "-tAc", q],
                          capture_output=True, text=True).stdout.strip()


def H(t): return {"Authorization": f"Bearer {t}"}


def pdf(text):
    from fpdf import FPDF
    p = FPDF(); p.add_page(); p.set_font("Helvetica", size=11); p.multi_cell(0, 6, text); return bytes(p.output())


def login(user, password, session=None):
    return (session or requests).post(f"{B}/auth/login", json={"username": user, "password": password})


# ---------- setup ----------
if psql("select count(*) from users") == "0":
    requests.post(f"{B}/auth/register", json={"username": "admin", "email": "admin@abc.com", "password": "Admin@1234"})
admin = psql("select u.username from users u join roles r on r.id=u.role_id where r.name='ADMIN' and u.auth_source='local' order by u.username limit 1")
tA = login(admin, "Admin@1234").json()["access_token"]
subprocess.run([PY, f"{RUN}/tools/license_issuer.py", "issue", "--private-key", f"{H2}/keys/priv.pem", "--registry", f"{H2}/sec-reg.json",
                "--customer", "Sec", "--days", "365", "--out", f"{H2}/sec.license"], capture_output=True)
requests.post(f"{B}/license/install", headers=H(tA), json={"license_text": open(f"{H2}/sec.license").read()})
for name in ("s_alice", "s_bob", "s_lock", "s_mfa"):
    requests.post(f"{B}/users/", headers=H(tA), json={"username": name, "email": f"{name}@abc.com", "password": "Pass@1234", "role": "USER"})

print("\n== API DOCS OFF BY DEFAULT ==")
check("/docs not available", requests.get(f"{B}/docs").status_code == 404)
check("/openapi.json not available", requests.get(f"{B}/openapi.json").status_code == 404)

print("\n== SESSION COOKIE ==")
s = requests.Session()
r = login("s_alice", "Pass@1234", s)
cookie_header = r.headers.get("set-cookie", "")
check("Login returns an access token but no refresh token in the body", "access_token" in r.json() and "refresh_token" not in r.json(), r.json().keys())
check("Session cookie is HttpOnly and SameSite=Strict", COOKIE in cookie_header and "HttpOnly" in cookie_header and "samesite=strict" in cookie_header.lower(), cookie_header)
check("Cookie is not marked Secure on plain http (auto mode)", "Secure" not in cookie_header)
first = s.cookies.get(COOKIE)
r = s.post(f"{B}/auth/refresh", json={})
check("Refresh works with the cookie alone", r.status_code == 200 and "access_token" in r.json(), r.text)
second = s.cookies.get(COOKIE)
check("Refresh rotates the cookie", second and second != first)
r = requests.post(f"{B}/auth/refresh", cookies={COOKIE: first}, json={})
check("Second tab using the just-replaced cookie still works (grace period)", r.status_code == 200, r.text)
check("Refresh without a cookie is refused", requests.post(f"{B}/auth/refresh", json={}).status_code == 401)
r = s.post(f"{B}/auth/logout", json={})
check("Logout clears the cookie", r.status_code == 200 and COOKIE in r.headers.get("set-cookie", "") and "Max-Age=0" in r.headers.get("set-cookie", ""))
check("…and the session is gone on the server", requests.post(f"{B}/auth/refresh", cookies={COOKIE: second}, json={}).status_code == 401)
s2 = requests.Session(); login("s_alice", "Pass@1234", s2)
old = s2.cookies.get(COOKIE)
s2.post(f"{B}/auth/refresh", json={})
print("      (waiting 32 s for the grace period to pass)")
time.sleep(32)
check("An old cookie used after the grace period is refused", requests.post(f"{B}/auth/refresh", cookies={COOKIE: old}, json={}).status_code == 401)
check("…and ends that whole session (theft protection)", s2.post(f"{B}/auth/refresh", json={}).status_code == 401)
r = requests.Session(); t = login("s_bob", "Pass@1234", r).json()["access_token"]
c = r.patch(f"{B}/auth/change-password", headers=H(t), json={"current_password": "Pass@1234", "new_password": "Fresh@5678x"})
check("Password change issues a new session cookie", c.status_code == 200 and COOKIE in c.headers.get("set-cookie", "") and "refresh_token" not in c.json())
psql("update users set password_hash=(select password_hash from users where username='s_alice') where username='s_bob'")

print("\n== ACCOUNT LOCKOUT ==")
for _ in range(5):
    login("s_lock", "wrong-password")
r = login("s_lock", "Pass@1234")
check("After 5 wrong passwords even the right password is refused", r.status_code == 401, r.text)
check("Message does not reveal whether the account exists", r.json()["detail"] == login("no-such-user", "x").json()["detail"])
users = requests.get(f"{B}/users/", headers=H(tA)).json()
lock_id = next(u["id"] for u in users if u["username"] == "s_lock")
check("Admin sees the account as locked", next(u for u in users if u["username"] == "s_lock")["locked"] is True)
check("Lock is recorded in the audit log", psql("select count(*) from audit_events where action='auth.account_locked'") != "0")
check("Non-admin cannot unlock", requests.post(f"{B}/users/{lock_id}/unlock", headers=H(login("s_alice", "Pass@1234").json()["access_token"])).status_code == 403)
r = requests.post(f"{B}/users/{lock_id}/unlock", headers=H(tA))
check("Admin unlocks the account", r.status_code == 200 and r.json()["locked"] is False)
check("User signs in again after unlock", login("s_lock", "Pass@1234").status_code == 200)
for _ in range(4):
    login("s_lock", "wrong-password")
login("s_lock", "Pass@1234")
login("s_lock", "wrong-password")
check("A successful sign-in resets the failure counter", login("s_lock", "Pass@1234").status_code == 200)
psql("update users set locked_until = now() at time zone 'utc' - interval '1 minute' where username='s_lock'")
check("An expired lock no longer blocks", login("s_lock", "Pass@1234").status_code == 200)

print("\n== TWO-STEP CODES WORK ONCE ==")
t = login("s_mfa", "Pass@1234").json()["access_token"]
secret = requests.post(f"{B}/auth/mfa/setup", headers=H(t)).json()["secret"]
totp = pyotp.TOTP(secret)
requests.post(f"{B}/auth/mfa/enable", headers=H(t), json={"code": totp.now()})
# wait for a fresh 30-second step so the enable code is not reused
time.sleep(31 - (time.time() % 30))
code = totp.now()
j = login("s_mfa", "Pass@1234").json()
r = requests.post(f"{B}/auth/mfa/verify", json={"mfa_token": j["mfa_token"], "code": code})
check("Fresh code signs in", r.status_code == 200, r.text)
j = login("s_mfa", "Pass@1234").json()
r = requests.post(f"{B}/auth/mfa/verify", json={"mfa_token": j["mfa_token"], "code": code})
check("The same code cannot be used a second time", r.status_code == 401, r.text)
for _ in range(5):
    requests.post(f"{B}/auth/mfa/verify", json={"mfa_token": j["mfa_token"], "code": "000000"})
check("Wrong two-step codes also lock the account", login("s_mfa", "Pass@1234").status_code == 401)
uid = psql("select id from users where username='s_mfa'")
requests.post(f"{B}/users/{uid}/unlock", headers=H(tA))

print("\n== SEARCH SCOPING FROM THE DATABASE ==")
ta = login("s_alice", "Pass@1234").json()["access_token"]
tb = login("s_bob", "Pass@1234").json()["access_token"]
def upload(t, name, text):
    d = requests.post(f"{B}/documents/upload", headers=H(t), files={"file": (name, pdf(text), "application/pdf")}).json()
    for _ in range(150):
        if requests.get(f"{B}/documents/{d['id']}", headers=H(t)).json().get("status") == "ready": return d["id"]
        time.sleep(0.3)
pa = upload(ta, "alice-salary-report.pdf", "Salary report: the codeword is MANGO-77 and the bonus is 5000.")
pb = upload(tb, "bob-travel-policy.pdf", "Travel policy: hotel limit 4000 per night, bonus not included.")
j = requests.post(f"{B}/query/", headers=H(ta), json={"query": "what does the salary report say about bonus"}).json()
check("Naming a document still focuses the search on it", j["sources"] and all(src["document_id"] == pa for src in j["sources"]), j.get("sources"))
j = requests.post(f"{B}/query/", headers=H(tb), json={"query": "alice salary report bonus codeword"}).json()
check("Naming someone else's private document does not reveal it", all(src["document_id"] != pa for src in j.get("sources", [])))
r = requests.post(f"{B}/query/stream", headers=H(tb), json={"query": "alice salary report codeword"})
check("Same for streaming answers", pa not in r.text and "MANGO" not in r.text)

print("\n== MISC ==")
out = subprocess.run([PY, "-c", "from app.services.ollama_service import _payload; print(_payload('x', False, False, 0.1, None)['keep_alive'])"],
                     cwd=RUN, capture_output=True, text=True, env={**os.environ, "PYTHONPATH": H2,
                     "DATABASE_URL": "postgresql+psycopg2://postgres@localhost:5432/rag_app", "JWT_SECRET_KEY": "x" * 40})
check("AI model is kept loaded between questions (keep_alive)", out.stdout.strip() == "30m", out.stderr[-200:])
env = {**os.environ, "RAGENTIS_BACKUP_PASSPHRASE": "a long backup passphrase"}
data = os.urandom(300000)
enc = subprocess.run([PY, "-m", "app.tools.backup_crypto", "encrypt"], input=data, capture_output=True, cwd=RUN, env=env).stdout
dec = subprocess.run([PY, "-m", "app.tools.backup_crypto", "decrypt"], input=enc, capture_output=True, cwd=RUN, env=env).stdout
bad = subprocess.run([PY, "-m", "app.tools.backup_crypto", "decrypt"], input=enc, capture_output=True, cwd=RUN,
                     env={**env, "RAGENTIS_BACKUP_PASSPHRASE": "another passphrase!!"})
check("Encrypted backup round trip", dec == data and data not in enc)
check("Wrong backup passphrase refused", bad.returncode != 0 and not bad.stdout)

print(f"\nSECURITY RESULT: {sum(R)}/{len(R)} passed")
