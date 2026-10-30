"""Stand-in for Ollama (real model cannot be downloaded here). Supports
stream=true (NDJSON), format=json for analytics specs and extraction."""
import json, re, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import os
H2 = os.environ.get("E2E_DIR", "/tmp/claude-0/harness2")


def answer_for(prompt, data):
    if data.get("format") == "json":
        if "<columns>" in prompt:
            cols = re.findall(r'- "([^"]+)" \((\w+)\)', prompt.split("<columns>")[1].split("</columns>")[0])
            q = prompt.split("<question>")[1].split("</question>")[0].lower()
            num = next((c for c, k in cols if k == "number"), None)
            date = next((c for c, k in cols if k == "date"), None)
            cat = next((c for c, k in cols if k == "category"), None)
            if "nonsense" in q:
                return "not json at all"
            if "evil" in q:
                return json.dumps({"metric": "sum", "value_column": "__import__('os').system('id')"})
            if "by region" in q:
                spec = {"metric": "sum", "value_column": num, "group_by": cat, "sort": "value_desc"}
            elif "trend" in q or "month" in q:
                spec = {"metric": "sum", "value_column": num, "group_by": date, "time_grain": "month"}
            else:
                spec = {"metric": "sum", "value_column": num}
            if "south" in q and cat:
                spec["filters"] = [{"column": cat, "op": "eq", "value": "South"}]
            return json.dumps(spec)
        m = re.search(r"exactly these keys: (.*?)\.\n", prompt)
        keys = re.findall(r'"([^"]+)"', m.group(1)) if m else []
        doc = prompt.split("<document", 1)[1]
        out = {}
        for k in keys:
            pat = re.escape(k).replace("_", "[ _]").replace("\\ ", "[ _]")
            mm = re.search(pat + r"\s*[:=]\s*([^\n]+)", doc, re.I)
            out[k] = mm.group(1).strip() if mm else None
        return json.dumps(out)
    if "Summarise the document" in prompt:
        return "- Fake summary bullet one\n- Fake summary bullet two\nKey dates/amounts: none"
    if "what changed" in prompt.lower():
        return "- Fake change summary"
    if "NOANSWER" in prompt.split("<question>")[-1]:
        return "I cannot answer this question as it is not in your uploaded documents."
    return "[FAKE-LLM] answered from context (" + str(len(prompt)) + " chars) [1]"


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _json(self, o):
        b = json.dumps(o).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        self._json({"models": [{"name": "llama3.2:3b"}]})

    def do_POST(self):
        d = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        p = d.get("prompt", "")
        with open(f"{H2}/last_prompt.txt", "w") as f:
            f.write(p)
        text = answer_for(p, d)
        if d.get("stream"):
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.send_header("Transfer-Encoding", "chunked")
            self.end_headers()
            slow = "SLOWSTREAM" in p.split("<question>")[-1]
            words = text.split(" ") * (200 if slow else 1)
            try:
                for w in words:
                    line = json.dumps({"response": w + " ", "done": False}).encode() + b"\n"
                    self.wfile.write(hex(len(line))[2:].encode() + b"\r\n" + line + b"\r\n")
                    self.wfile.flush()
                    time.sleep(0.05 if slow else 0.002)
                line = json.dumps({"response": "", "done": True}).encode() + b"\n"
                self.wfile.write(hex(len(line))[2:].encode() + b"\r\n" + line + b"\r\n0\r\n\r\n")
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                with open(f"{H2}/stream_aborted.txt", "w") as f:
                    f.write("aborted")
                self.close_connection = True
            return
        self._json({"model": d.get("model"), "response": text, "done": True})

    def log_message(self, *a):
        pass


ThreadingHTTPServer(("127.0.0.1", 11434), H).serve_forever()
