#!/usr/bin/env python3
"""Render out/metrics.json into a phone-readable progress page.

Images are inlined as data URIs so the file is one self-contained thing you can
open from anywhere. If the batch ran without credentials the page says so in a
banner at the top and on every still — a wireframe must never be mistaken for a
render by someone glancing at this on a phone.
"""
import argparse
import base64
import html
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

CSS = """
:root{--bg:#0b0d12;--card:#151823;--ink:#eef1f7;--dim:#8b93a7;--ok:#25e39a;
--bad:#ff5c5c;--warn:#ffc857;--line:#242938}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:16px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:960px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--dim);font-size:14px;margin-bottom:20px}
.banner{background:#3a1d1d;border:1px solid #6b2b2b;border-radius:10px;
padding:12px 14px;margin-bottom:20px;font-size:14px}
.banner b{color:var(--warn)}
.grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
margin-bottom:24px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px}
.stat .k{color:var(--dim);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
.stat .v{font-size:26px;font-weight:650;margin-top:6px;font-variant-numeric:tabular-nums}
.v.ok{color:var(--ok)} .v.bad{color:var(--bad)} .v.warn{color:var(--warn)}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);
margin:28px 0 12px;border-top:1px solid var(--line);padding-top:18px}
.frames{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:12px;
overflow:hidden}
figure img{width:100%;display:block;background:#000}
figcaption{padding:8px 10px;font-size:12px;color:var(--dim)}
figcaption b{color:var(--ink);font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{text-align:left;padding:8px 6px;border-bottom:1px solid var(--line);
vertical-align:top}
th{color:var(--dim);font-weight:600;font-size:11px;text-transform:uppercase;
letter-spacing:.06em}
code{background:#0f121b;padding:1px 5px;border-radius:4px;font-size:12px;color:#c7d0e4}
.tag{display:inline-block;padding:2px 7px;border-radius:99px;font-size:11px;
background:#2a2033;color:var(--warn)}
"""


def data_uri(path):
    try:
        raw = Path(path).read_bytes()
    except OSError:
        return None
    return "data:image/png;base64," + base64.b64encode(raw).decode()


def stat(k, v, cls=""):
    return (f'<div class="stat"><div class="k">{html.escape(k)}</div>'
            f'<div class="v {cls}">{html.escape(str(v))}</div></div>')


def build_page(m):
    degraded = not m.get("frames_are_renders")
    q = m.get("qa", {})
    det = m.get("determinism", {})

    parts = [f"<style>{CSS}</style>", '<div class="wrap">']
    parts.append(f'<h1>{html.escape(m.get("brief", "batch"))} — factory run</h1>')
    parts.append(
        f'<div class="sub">{m["variants"]} variants · '
        f'{m["canvas"]["width"]}×{m["canvas"]["height"]} @ {m["canvas"]["fps"]}fps · '
        f'backend <code>{m["backend"]}</code></div>')

    if degraded:
        parts.append(
            '<div class="banner"><b>DEGRADED — these stills are wireframes, '
            'not renders.</b><br>No Idomoo credentials are present, so '
            '<code>strata snapshot</code> and <code>strata render</code> cannot run. '
            'The boxes below show real layout geometry; they show nothing about '
            'type, colour, motion or design quality. Batch counts, compile times, '
            'determinism and QA failures on this page <i>are</i> measured on real '
            'output.</div>')

    passed, total = m["variants_passed_qa"], m["variants"]
    parts.append('<div class="grid">')
    parts.append(stat("variants", total))
    parts.append(stat("passed QA", f"{passed}/{total}",
                      "ok" if passed == total else "warn"))
    parts.append(stat("layout failures", m["variants_failed_qa"],
                      "ok" if not m["variants_failed_qa"] else "bad"))
    parts.append(stat("batch wall time", f'{m["batch_wall_s"]}s'))
    parts.append(stat("variants / min", m.get("variants_per_min") or "—"))
    cm = m.get("compile_ms") or {}
    parts.append(stat("compile p95", f'{cm.get("p95", "—")} ms'))
    if det.get("checked"):
        ident = det["identical"] == det["variants"]
        parts.append(stat("byte-identical rebuild",
                          f'{det["identical"]}/{det["variants"]}',
                          "ok" if ident else "bad"))
    parts.append(stat("render time",
                      "—" if degraded else m.get("render_s", "—")))
    parts.append("</div>")

    stills = [s for s in m.get("stills", []) if s.get("ok")]
    if stills:
        label = "Wireframes" if degraded else "Frames"
        parts.append(f"<h2>{label} — newest run</h2>")
        parts.append('<div class="frames">')
        for s in stills[:40]:
            uri = data_uri(s["path"])
            if not uri:
                continue
            tag = ' <span class="tag">wireframe</span>' if degraded else ""
            nm = html.escape(s["name"] or s["id"])
            parts.append(
                f'<figure><img loading="lazy" src="{uri}" alt="{nm}">'
                f'<figcaption><b>{nm}</b><br>{html.escape(s["beat"])} '
                f'@ {s["at"]}s{tag}</figcaption></figure>')
        parts.append("</div>")

    if q.get("issues_by_check"):
        parts.append("<h2>QA issues by check</h2><table>"
                     "<tr><th>check</th><th>count</th></tr>")
        for k, v in sorted(q["issues_by_check"].items(), key=lambda kv: -kv[1]):
            parts.append(f"<tr><td><code>{html.escape(k)}</code></td><td>{v}</td></tr>")
        parts.append("</table>")

    fails = m.get("failures") or []
    if fails:
        parts.append("<h2>Failing variants</h2><table>"
                     "<tr><th>id</th><th>row</th><th>why</th></tr>")
        for f in fails[:40]:
            why = "<br>".join(html.escape(i["detail"]) for i in f["issues"])
            parts.append(
                f'<tr><td><code>{html.escape(f["id"])}</code></td>'
                f'<td>{html.escape(f["name"] or "—")}'
                + (f'<br><span class="tag">{html.escape(f["note"])}</span>'
                   if f["note"] else "")
                + f'</td><td>{why}</td></tr>')
        parts.append("</table>")

    parts.append("</div>")
    return (f'<title>{html.escape(m.get("brief", "factory"))} — progress</title>'
            + "".join(parts))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--metrics", default=str(HERE / "out/metrics.json"))
    ap.add_argument("-o", "--out", default=str(HERE / "out/progress.html"))
    a = ap.parse_args()
    m = json.loads(Path(a.metrics).read_text(encoding="utf-8"))
    Path(a.out).write_text(build_page(m), encoding="utf-8")
    size_kb = Path(a.out).stat().st_size / 1024
    print(f"wrote {a.out} ({size_kb:.0f} KB)")


if __name__ == "__main__":
    main()
