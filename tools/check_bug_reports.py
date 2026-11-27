"""Check the bug report integration in every published game/lab entry."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]
class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.scripts=[]; self.styles=[]; self.routes=[]; self.card=False
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=="article" and "game" in a.get("class","").split(): self.card=True
        if tag=="a":
            h=a.get("href","")
            if self.card and h.startswith("./") and h!="./": self.routes.append(h)
            if "data-euclidi-bug-report" in a: self.links.append(a)
        if tag=="script" and a.get("src","").split("?")[0].endswith("/bug-report.js"): self.scripts.append(a)
        if tag=="link" and a.get("href","").split("?")[0].endswith("/bug-report.css"): self.styles.append(a)
    def handle_endtag(self, tag):
        if tag=="article": self.card=False
def parse(p):
    x=Parser(); x.feed(p.read_text(encoding="utf-8")); return x
def resolve(p,u):
    return (p.parent/unquote(urlsplit(u).path)).resolve()
def main():
    entries=set(ROOT.glob("*/index.html"))
    for p in list(entries):
        entries.update(x for x in p.parent.rglob("index.html") if not any(i in ("vendor","assets","node_modules",".git") for i in x.relative_to(ROOT).parts))
    for href in parse(ROOT/"index.html").routes:
        p=resolve(ROOT/"index.html",href)
        entries.add(p/"index.html" if p.is_dir() else p)
    errors=[]
    for p in sorted(entries):
        try:
            x=parse(p)
            assert len(x.links)==1, "expected one bug report link"
            assert len(x.scripts)==1 and len(x.styles)==1, "missing shared reporter assets"
            s=x.scripts[0]; a=x.links[0]
            assert s.get("data-repo") in ("euclidi/euclidi-games","euclidi/euclidi-labs") and s.get("data-project"), "missing project identity"
            assert urlsplit(a.get("href","")).netloc=="github.com" and urlsplit(a["href"]).path=="/"+s["data-repo"]+"/issues/new", "wrong issue destination"
            assert a.get("target")=="_blank" and "noopener" in a.get("rel","").split() and "hidden" not in a, "invalid fallback link"
            assert resolve(p,s["src"])==ROOT/"assets/shared/bug-report.js", "wrong script path"
            assert resolve(p,x.styles[0]["href"])==ROOT/"assets/shared/bug-report.css", "wrong stylesheet path"
            assert (ROOT/"assets/shared/bug-report.js").is_file() and (ROOT/"assets/shared/bug-report.css").is_file()
            print("PASS",p.relative_to(ROOT))
        except Exception as e: errors.append(str(p.relative_to(ROOT))+": "+str(e))
    if errors or not entries: raise SystemExit("\n".join(errors) or "No entries")
    print(f"PASS: {len(entries)} reporting entry points")
if __name__=="__main__": main()
