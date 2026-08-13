#!/usr/bin/env python3
"""Generate theory/index.html from theory/SQL.ipynb.

Run again (`python3 theory/build_theory.py`) whenever SQL.ipynb changes.
"""
import json
import re
import html
from pathlib import Path

ROOT = Path(__file__).parent
NOTEBOOK = ROOT / "SQL.ipynb"
OUTPUT = ROOT / "index.html"

QUERY_RE = re.compile(r'query(?:_\w*)?\s*=\s*\(?\s*"""(.*?)"""', re.DOTALL)
TABLE_RE = re.compile(r"<table.*?</table>", re.DOTALL)


def slugify(text):
    text = re.sub(r"[`*]", "", text)
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or "section"


def inline_md(text):
    text = html.escape(text, quote=False)
    text = re.sub(r"`([^`]+)`", r"<code>\1</code>", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", text)
    text = re.sub(r"(?<!\*)\*([^*\n]+)\*(?!\*)", r"<em>\1</em>", text)
    return text


def render_markdown(src, toc, sections):
    lines = src.split("\n")
    html_parts = []
    i = 0
    list_buf = []

    def flush_list():
        if list_buf:
            html_parts.append("<ul>" + "".join(f"<li>{inline_md(x)}</li>" for x in list_buf) + "</ul>")
            list_buf.clear()

    para_buf = []

    def flush_para():
        if para_buf:
            html_parts.append(f"<p>{inline_md(' '.join(para_buf))}</p>")
            para_buf.clear()

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_list()
            flush_para()
            lang = stripped[3:].strip()
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            html_parts.append(
                f'<pre class="code-block"><code>{html.escape(chr(10).join(code_lines))}</code></pre>'
            )
            i += 1
            continue

        heading_match = re.match(r"^(#{1,3})\s+(.*)$", stripped)
        if heading_match:
            flush_list()
            flush_para()
            level = len(heading_match.group(1))
            title = heading_match.group(2).strip()
            plain_title = re.sub(r"[`*]", "", title)
            slug = slugify(plain_title)
            tag = "h2" if level == 1 else "h3"
            html_parts.append(f'<{tag} id="{slug}">{inline_md(title)}</{tag}>')
            if level == 1:
                sections.append({"id": slug, "title": plain_title, "subs": []})
            elif sections:
                sections[-1]["subs"].append({"id": slug, "title": plain_title})
            i += 1
            continue

        if stripped.startswith("- "):
            flush_para()
            list_buf.append(stripped[2:].strip())
            i += 1
            continue

        if not stripped:
            flush_list()
            flush_para()
            i += 1
            continue

        para_buf.append(stripped)
        i += 1

    flush_list()
    flush_para()
    return "\n".join(html_parts)


def render_code_cell(src, outputs):
    match = QUERY_RE.search(src)
    if not match:
        return ""
    sql = match.group(1).strip("\n")
    parts = [f'<pre class="code-block"><code>{html.escape(sql)}</code></pre>']

    for out in outputs:
        data = out.get("data", {})
        if "text/html" in data:
            raw = "".join(data["text/html"])
            table_match = TABLE_RE.search(raw)
            if table_match:
                table_html = table_match.group(0)
                table_html = table_html.replace('border="1" class="dataframe"', "")
                parts.append(f'<div class="table-scroll">{table_html}</div>')
    return f'<div class="query-example">{"".join(parts)}</div>'


def build():
    nb = json.loads(NOTEBOOK.read_text())
    sections = []
    body_parts = []

    for cell in nb["cells"]:
        src = "".join(cell["source"])
        if cell["cell_type"] == "markdown":
            body_parts.append(render_markdown(src, None, sections))
        elif cell["cell_type"] == "code":
            body_parts.append(render_code_cell(src, cell.get("outputs", [])))

    body_html = "\n".join(p for p in body_parts if p)

    nav_html = []
    for sec in sections:
        title = html.escape(sec["title"])
        if not sec["subs"]:
            nav_html.append(f'<a class="theory-nav-group theory-nav-flat" href="#{sec["id"]}">{title}</a>')
            continue
        subs_html = "".join(
            f'<a class="theory-nav-sub" href="#{s["id"]}">{html.escape(s["title"])}</a>' for s in sec["subs"]
        )
        nav_html.append(
            f'<details class="theory-nav-group" open>'
            f'<summary><a class="theory-nav-title" href="#{sec["id"]}">{title}</a></summary>'
            f'<div class="theory-nav-subs">{subs_html}</div>'
            f"</details>"
        )
    nav_html = "\n".join(nav_html)

    page = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Théorie SQL — SQL Trainer</title>
<link rel="stylesheet" href="../css/styles.css" />
<link rel="stylesheet" href="../css/theory.css" />
</head>
<body>
<div class="app">
  <aside class="sidebar">
    <div class="sidebar-top">
      <h1 class="brand"><span class="brand-mark">SQL</span>Trainer</h1>
      <a href="../index.html" class="btn btn-ghost btn-small theory-back">&larr; Retour aux exercices</a>
    </div>
    <nav class="category-nav theory-nav" aria-label="Sommaire théorie">
      {nav_html}
    </nav>
  </aside>
  <main class="content theory-content">
    {body_html}
  </main>
</div>
</body>
</html>
"""
    OUTPUT.write_text(page)
    print(f"Wrote {OUTPUT} ({len(sections)} sections)")


if __name__ == "__main__":
    build()
