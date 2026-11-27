"""Generate and validate the shared catalog from project manifests."""
import argparse, json, re, shutil
from pathlib import Path
from html import escape
ROOT = Path(__file__).resolve().parents[1]
DOCS = ("README.md", "SPEC.md", "ROADMAP.md", "STATUS.md")
REPO = "https://github.com/euclidi/euclidi-labs/blob/main/"
def region(text, name, body):
    pattern = rf"(<!-- {name} START -->)[\s\S]*?(<!-- {name} END -->)"
    result, n = re.subn(pattern, lambda m: m[1] + "\n" + body + "\n" + m[2], text)
    if n != 1: raise ValueError("Missing or duplicate region: " + name)
    return result
def inventory():
    ids = set()
    for p in sorted(ROOT.glob("*/project.json")):
        slug = p.parent.name
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", slug): raise ValueError(slug)
        m = json.loads(p.read_text())
        if type(m["id"]) is not int or m["id"] < 1 or m["id"] in ids: raise ValueError("Invalid/duplicate id: " + slug)
        ids.add(m["id"])
        for key in ("title", "category", "version", "description"):
            if not isinstance(m[key], str) or not m[key].strip(): raise ValueError(slug + ": " + key)
        for name in (*DOCS, "index.html"):
            target = p.parent / name
            if not target.is_file() or not target.read_text().strip(): raise ValueError("Missing/empty " + str(target))
        for key, default in (("color","#26332d"),("ink","#dce6c8")):
            m.setdefault(key,default)
            if not re.fullmatch(r"#[0-9a-fA-F]{6}",m[key]): raise ValueError("Invalid color")
        if m.get("cover"):
            cover = p.parent / m["cover"]
            if not cover.resolve().is_relative_to(p.parent.resolve()) or not cover.is_file(): raise ValueError("Invalid cover")
            if not re.fullmatch(r"[a-zA-Z0-9_./-]+",m["cover"]): raise ValueError("Invalid cover path")
        if not m.get("archived"): yield slug,m
def generate(items):
    cards, rows = [], []
    for slug,m in items:
        title,cat,version,desc = (escape(m[k],quote=True) for k in ("title","category","version","description"))
        url = "./" + slug + "/"
        art = f'<img src="{url}{escape(m["cover"],quote=True)}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;z-index:-1">' if m.get("cover") else ""
        links = "".join(f'<a href="{REPO}{slug}/{d}">{label}</a>' for d,label in zip(DOCS,("About","Spec","Roadmap","Status")))
        cards.append(f'<article class="game" data-category="{cat}" data-name="{title}" style="--ink:{m["ink"]};--cover:{m["color"]}"><a class="cover" href="{url}" aria-label="Open {title}">{art}<span class="cover-top"><span>EL / {m["id"]:03}</span><span>{cat}</span></span><span class="cover-title">{title}</span><span class="cover-bottom">EUCLIDI LABS</span></a><div class="info"><div class="meta"><span>{cat}</span><span>{version}</span></div><h2>{title}</h2><p>{desc}</p><div class="actions"><a class="play" href="{url}">Open <span aria-hidden="true">▶</span></a></div></div><nav class="project-docs" aria-label="{title} documentation">{links}</nav></article>')
        rows.append(f'- [{title}]({slug}/README.md) — {version} · [Spec]({slug}/SPEC.md) · [Roadmap]({slug}/ROADMAP.md) · [Status]({slug}/STATUS.md)')
    return {"index.html":region((ROOT/"index.html").read_text(),"PROJECT CARDS","\n".join(cards)), "README.md":region((ROOT/"README.md").read_text(),"PROJECT INDEX","\n".join(rows))}
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--check",action="store_true")
    parser.add_argument("--stage",type=Path)
    args=parser.parse_args()
    items=sorted(inventory(),key=lambda x:x[1]["id"])
    for name,content in generate(items).items():
        p=ROOT/name
        if args.check or args.stage:
            if p.read_text()!=content: raise SystemExit(name+" stale; run tools/catalog.py")
        else: p.write_text(content)
    if args.stage:
        out=args.stage
        out.mkdir(parents=True,exist_ok=True)
        for name in ("index.html","site.webmanifest",".nojekyll"):
            shutil.copy2(ROOT/name,out/name)
        for name in ("assets",):
            shutil.copytree(ROOT/name,out/name,dirs_exist_ok=True,ignore=shutil.ignore_patterns("*.md"))
        for slug,_ in items:
            if any(p.is_symlink() for p in (ROOT/slug).rglob("*")): raise ValueError("Symlink in "+slug)
            shutil.copytree(ROOT/slug,out/slug,dirs_exist_ok=True,ignore=shutil.ignore_patterns(".git",".env*","node_modules","__pycache__"))
    print(f"PASS: {len(items)} active projects")
if __name__=="__main__": main()
