# Test harness: stand-ins for the two models that cannot be downloaded here.
import sys, types, re, hashlib, math
def _words(t): return re.findall(r"[a-z0-9]+", (t or "").lower())
def _vec(t):
    v=[0.0]*384
    for w in _words(t):
        if len(w)<=2: continue
        h=int(hashlib.md5(w.encode()).hexdigest(),16); v[h%384]+=1.0
    n=math.sqrt(sum(x*x for x in v)) or 1.0
    return [x/n for x in v]
class _Arr(list):
    def tolist(self): return [list(x) if isinstance(x,list) else x for x in self]
class FakeST:
    def __init__(self,*a,**k): pass
    def encode(self,x,normalize_embeddings=True,**k):
        if isinstance(x,str): return _Arr(_vec(x))
        import time as _t
        _t.sleep(0.04 * len(x))  # simulate CPU embedding cost
        return _Arr([_vec(s) for s in x])
st=types.ModuleType("sentence_transformers"); st.SentenceTransformer=FakeST; sys.modules["sentence_transformers"]=st
class FakeTok:
    def encode(self,t,**k): return list(range(len(re.findall(r"\w+|[^\w\s]",t or ""))))
class AutoTokenizer:
    @staticmethod
    def from_pretrained(*a,**k): return FakeTok()
tr=types.ModuleType("transformers"); tr.AutoTokenizer=AutoTokenizer; sys.modules["transformers"]=tr
