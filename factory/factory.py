#!/usr/bin/env python3
"""The factory: brief + data feed -> N compiled, QA'd video variants.

    python3 factory/factory.py --rows 500 --frames 12

Pipeline per row: build scene (pure function) -> write scene.json -> strata
compile -> .idm -> QA gate -> optionally a frame the critic can look at.

The one thing this file is careful about is the difference between what is
measured and what is asserted. Compile time, variant count, determinism and
layout failures are measured here on real output. Render time and real rendered
frames are NOT — they need Idomoo credentials, and without them the frame step
falls back to `strata preview`, which draws a wireframe, not a render. That
fallback is labelled DEGRADED everywhere it appears, including in metrics.json,
so nobody mistakes a wireframe for a frame.
"""
import argparse
import concurrent.futures as cf
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from qa import check_scene, summarise          # noqa: E402
from scene import build, load_brief            # noqa: E402

STRATA = shutil.which("strata") or str(Path.home() / ".local/bin/strata")


def run(cmd, timeout=180):
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", f"timeout after {timeout}s"
    except FileNotFoundError as e:
        return 127, "", str(e)


def strata_json(args, timeout=180):
    code, out, err = run([STRATA, *args, "--json"], timeout)
    try:
        return code, json.loads(out or err or "{}")
    except json.JSONDecodeError:
        return code, {"ok": False, "error": (out or err or "").strip()[:400]}


_CREATED_RE = re.compile(rb'"Created":\d+')


def payload_digest(path):
    """SHA-256 of the .idm with its volatile header masked.

    Two compiles of the same scene differ in exactly two places: a 4-byte id at
    offset 8 (derived from the source path) and a `"Created":<unix>` stamp in
    the header JSON. Both are build metadata, not content — the same reason you
    normalise mtimes before comparing two zips. Masking them measures whether
    the *video* is reproducible, which is the claim that matters. The unmasked
    digest is kept alongside so the distinction stays visible.
    """
    raw = bytearray(path.read_bytes())
    raw[8:12] = b"\0\0\0\0"
    head = _CREATED_RE.sub(b'"Created":0', bytes(raw[:512]))
    return hashlib.sha256(head + bytes(raw[512:])).hexdigest()


def have_credentials():
    if os.environ.get("IDOMOO_ACCOUNT_ID") and os.environ.get("IDOMOO_SECRET_KEY"):
        return True
    code, data = strata_json(["auth", "status"], timeout=30)
    return bool(data.get("ok")) and not data.get("error")


# ------------------------------------------------------------------ one row

def build_one(brief, row, seed, dirs):
    t0 = time.perf_counter()
    scene, notes = build(brief, row, seed)
    scene_path = dirs["scenes"] / f"{row['id']}.json"
    scene_path.write_text(json.dumps(scene, ensure_ascii=False, indent=1),
                          encoding="utf-8")
    build_ms = (time.perf_counter() - t0) * 1000

    t1 = time.perf_counter()
    idm_path = dirs["idm"] / f"{row['id']}.idm"
    code, info = strata_json(["compile", str(scene_path), "-o", str(idm_path)])
    compile_ms = (time.perf_counter() - t1) * 1000

    issues = check_scene(scene, brief, notes)
    if code != 0 or not info.get("ok"):
        issues.append({"check": "compile", "severity": "fail",
                       "detail": info.get("error", f"exit {code}")})

    digest = payload = None
    if idm_path.exists():
        digest = hashlib.sha256(idm_path.read_bytes()).hexdigest()
        payload = payload_digest(idm_path)

    return {
        "id": row["id"], "name": row.get("name", ""), "note": row.get("note", ""),
        "scene": str(scene_path), "idm": str(idm_path) if digest else None,
        "idm_sha256": digest, "payload_sha256": payload,
        "build_ms": round(build_ms, 2), "compile_ms": round(compile_ms, 2),
        "duration_s": info.get("duration_s"), "frames": info.get("frames"),
        "issues": issues,
        "ok": not any(i["severity"] == "fail" for i in issues),
    }


def frame_one(scene_path, out_png, at, backend):
    """Produce something the critic can look at. Returns (ok, mode, detail)."""
    if backend == "cloud":
        code, info = strata_json(
            ["snapshot", str(scene_path), "--at", str(at), "-o", str(out_png)],
            timeout=600)
        if code == 0 and info.get("ok"):
            return True, "render", info.get("path", str(out_png))
        return False, "render", info.get("error", f"exit {code}")

    code, info = strata_json(["preview", str(scene_path), "--at", str(at)])
    if code == 0 and info.get("ok"):
        src = Path(info["path"])
        if src.resolve() != Path(out_png).resolve():
            shutil.move(str(src), out_png)
        return True, "wireframe", str(out_png)
    return False, "wireframe", info.get("error", f"exit {code}")


# ------------------------------------------------------------------ batch

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brief", default=str(HERE / "brief.json"))
    ap.add_argument("--data", default=str(HERE / "data/audience.csv"))
    ap.add_argument("--out", default=str(HERE / "out"))
    ap.add_argument("--rows", type=int, default=0, help="0 = every row")
    ap.add_argument("--frames", type=int, default=8,
                    help="how many variants to produce stills for")
    ap.add_argument("--at", type=float, nargs="*", default=[1.3, 4.0, 7.2, 10.3, 13.4],
                    help="timestamps to sample, one per beat")
    ap.add_argument("--backend", choices=["auto", "cloud", "wireframe"], default="auto")
    ap.add_argument("--jobs", type=int, default=min(16, (os.cpu_count() or 4)))
    ap.add_argument("--seed", type=int, default=1729)
    ap.add_argument("--verify-determinism", action="store_true",
                    help="build the batch twice and compare .idm digests")
    a = ap.parse_args()

    brief = load_brief(a.brief)
    with open(a.data, encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if a.rows:
        rows = rows[:a.rows]

    out = Path(a.out)
    dirs = {k: out / k for k in ("scenes", "idm", "frames")}
    for d in dirs.values():
        d.mkdir(parents=True, exist_ok=True)

    backend = a.backend
    creds = have_credentials()
    if backend == "auto":
        backend = "cloud" if creds else "wireframe"
    if backend == "cloud" and not creds:
        print("!! --backend cloud requested but no Idomoo credentials found.",
              file=sys.stderr)

    print(f"factory: {len(rows)} variants · backend={backend} · jobs={a.jobs}")
    if backend == "wireframe":
        print("!! DEGRADED: no credentials, so stills are strata WIREFRAMES, not")
        print("!! renders. Layout geometry is real; type, colour and motion are")
        print("!! not shown. Do not judge design quality from these.")

    t0 = time.perf_counter()
    results = []
    with cf.ThreadPoolExecutor(max_workers=a.jobs) as ex:
        futs = {ex.submit(build_one, brief, r, a.seed, dirs): r for r in rows}
        for n, fut in enumerate(cf.as_completed(futs), 1):
            results.append(fut.result())
            if n % 50 == 0 or n == len(rows):
                print(f"  compiled {n}/{len(rows)}")
    batch_s = time.perf_counter() - t0
    results.sort(key=lambda r: r["id"])

    # --- determinism ------------------------------------------------------
    determinism = {"checked": False}
    if a.verify_determinism:
        print("verifying determinism (second pass)…")
        d2 = {k: out / f"_verify/{k}" for k in ("scenes", "idm", "frames")}
        for d in d2.values():
            d.mkdir(parents=True, exist_ok=True)
        with cf.ThreadPoolExecutor(max_workers=a.jobs) as ex:
            second = list(ex.map(lambda r: build_one(brief, r, a.seed, d2), rows))
        first = {r["id"]: r["payload_sha256"] for r in results}
        mismatch = [r["id"] for r in second
                    if first.get(r["id"]) != r["payload_sha256"]]
        determinism = {
            "checked": True, "variants": len(second),
            "identical": len(second) - len(mismatch),
            "mismatched": mismatch[:20],
            "basis": "sha256 of .idm with the 4-byte source-path id at offset 8 "
                     "and the header \"Created\" unix stamp masked; those are "
                     "build metadata, everything else is content",
        }
        shutil.rmtree(out / "_verify", ignore_errors=True)

    # --- stills -----------------------------------------------------------
    sample = [r for r in results if r["note"]][:a.frames]
    sample += [r for r in results if not r["note"]][:max(0, a.frames - len(sample))]
    stills = []
    for r in sample:
        for i, at in enumerate(a.at):
            png = dirs["frames"] / f"{r['id']}_t{i}.png"
            ok, mode, detail = frame_one(r["scene"], png, at, backend)
            stills.append({"id": r["id"], "name": r["name"], "at": at,
                           "beat": brief["beats"][i]["id"] if i < len(brief["beats"]) else "?",
                           "ok": ok, "mode": mode,
                           "path": str(png) if ok else None, "detail": detail})

    # --- metrics ----------------------------------------------------------
    compile_times = sorted(r["compile_ms"] for r in results)
    passed = sum(1 for r in results if r["ok"])
    metrics = {
        "generated_by": "factory.py",
        "backend": backend,
        "frames_are_renders": backend == "cloud",
        "credentials_present": creds,
        "brief": brief["name"],
        "canvas": brief["canvas"],
        "variants": len(results),
        "variants_passed_qa": passed,
        "variants_failed_qa": len(results) - passed,
        "batch_wall_s": round(batch_s, 2),
        "variants_per_min": round(len(results) / batch_s * 60, 1) if batch_s else None,
        "compile_ms": {
            "p50": compile_times[len(compile_times) // 2] if compile_times else None,
            "p95": compile_times[int(len(compile_times) * 0.95)] if compile_times else None,
            "max": compile_times[-1] if compile_times else None,
        },
        "render_s": None if backend != "cloud" else "see per-variant",
        "qa": summarise([r["issues"] for r in results]),
        "determinism": determinism,
        "stills": stills,
        "failures": [
            {"id": r["id"], "name": r["name"], "note": r["note"],
             "issues": [i for i in r["issues"] if i["severity"] == "fail"]}
            for r in results if not r["ok"]
        ][:50],
    }
    (out / "metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2),
                                      encoding="utf-8")
    (out / "variants.json").write_text(json.dumps(results, ensure_ascii=False, indent=1),
                                       encoding="utf-8")

    print(f"\n{len(results)} variants in {batch_s:.1f}s "
          f"({metrics['variants_per_min']}/min) · "
          f"{passed} passed QA, {len(results) - passed} failed")
    if determinism["checked"]:
        print(f"determinism: {determinism['identical']}/{determinism['variants']} "
              f"payload-identical .idm across two independent passes "
              f"(header id + Created stamp masked)")
    for check, n in sorted(metrics["qa"]["issues_by_check"].items()):
        print(f"  {check}: {n}")
    print(f"\nmetrics → {out / 'metrics.json'}")


if __name__ == "__main__":
    main()
