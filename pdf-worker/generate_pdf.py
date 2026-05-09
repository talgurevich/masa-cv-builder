#!/usr/bin/env python3
"""
generate_pdf.py — render a CV JSON file into a Hebrew RTL PDF.

Usage:
    python3 generate_pdf.py <input.json> [<output.pdf>]

If <output.pdf> is omitted, defaults to ~/Documents/CV-<name>-<YYYY-MM-DD>.pdf
where <name> is derived from personal.name in the JSON (slugified).

Pipeline: JSON -> Jinja2 (cv_template.html) -> headless Google Chrome -> PDF.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

try:
    from jinja2 import Environment, FileSystemLoader, select_autoescape
except ImportError:
    sys.stderr.write("ERROR: jinja2 is required. Install with: pip3 install jinja2\n")
    sys.exit(2)


SKILL_ROOT = Path(__file__).resolve().parent.parent
TEMPLATE_DIR = SKILL_ROOT / "templates"
TEMPLATE_NAME = "cv_template.html"

CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
]


def find_chrome() -> str:
    for path in CHROME_CANDIDATES:
        if Path(path).is_file():
            return path
    for name in ("google-chrome", "chromium", "chrome"):
        from shutil import which
        found = which(name)
        if found:
            return found
    sys.stderr.write(
        "ERROR: Could not find a Chromium-based browser to render the PDF.\n"
        "Install Google Chrome or set CHROME_PATH env var.\n"
    )
    sys.exit(3)


def slugify(value: str) -> str:
    if not value:
        return "draft"
    cleaned = re.sub(r"\s+", "-", value.strip())
    cleaned = re.sub(r"[^\w֐-׿\-]", "", cleaned)
    return cleaned or "draft"


def load_data(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("personal", {})
    data.setdefault("summary", "")
    data.setdefault("education", [])
    data.setdefault("experience", [])
    data.setdefault("military", {})
    data.setdefault("volunteering", [])
    data.setdefault("skills", {})
    data.setdefault("meta", {})
    return data


def render_html(data: dict) -> str:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=select_autoescape(["html", "xml"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template(TEMPLATE_NAME)
    return template.render(**data)


def _run_chrome(cmd: list[str], output_pdf: Path, timeout: int) -> tuple[str, str]:
    """Run chrome and wait for the PDF to be written.

    Chrome's headless mode sometimes hangs after writing the PDF (waiting on
    background network requests). We poll the output file: once its size has
    been non-zero and stable for ~1.5s, we consider the print complete and
    terminate Chrome rather than waiting for it to exit on its own.
    """
    import time

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    deadline = time.monotonic() + timeout
    last_size = -1
    stable_since: float | None = None
    poll_interval = 0.25
    stable_required = 1.5

    while time.monotonic() < deadline:
        if proc.poll() is not None:
            # Chrome exited on its own
            break

        size = output_pdf.stat().st_size if output_pdf.exists() else 0
        if size > 0:
            if size == last_size:
                if stable_since is None:
                    stable_since = time.monotonic()
                elif time.monotonic() - stable_since >= stable_required:
                    proc.terminate()
                    try:
                        proc.wait(timeout=3)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    break
            else:
                stable_since = None
                last_size = size
        time.sleep(poll_interval)
    else:
        # Hit hard timeout — kill Chrome
        proc.kill()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            pass

    try:
        out = proc.stdout.read().decode(errors="replace") if proc.stdout else ""
        err = proc.stderr.read().decode(errors="replace") if proc.stderr else ""
    except Exception:
        out, err = "", ""
    return out, err


def html_to_pdf(html: str, output_pdf: Path) -> None:
    chrome = os.environ.get("CHROME_PATH") or find_chrome()
    output_pdf.parent.mkdir(parents=True, exist_ok=True)
    if output_pdf.exists():
        output_pdf.unlink()

    with tempfile.TemporaryDirectory(prefix="cv-builder-") as tmpdir:
        tmp_html = Path(tmpdir) / "cv.html"
        tmp_html.write_text(html, encoding="utf-8")

        user_data_dir = Path(tmpdir) / "chrome-profile"
        user_data_dir.mkdir()

        cmd = [
            chrome,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--no-pdf-header-footer",
            "--hide-scrollbars",
            "--run-all-compositor-stages-before-draw",
            "--disable-extensions",
            "--disable-background-networking",
            "--disable-default-apps",
            "--disable-sync",
            "--no-first-run",
            "--no-default-browser-check",
            f"--user-data-dir={user_data_dir}",
            f"--print-to-pdf={output_pdf}",
            "--virtual-time-budget=4000",
            tmp_html.as_uri(),
        ]
        stdout, stderr = _run_chrome(cmd, output_pdf, timeout=30)

        if not output_pdf.is_file() or output_pdf.stat().st_size == 0:
            # Retry with legacy --headless flag for older Chrome builds
            cmd[1] = "--headless"
            stdout, stderr = _run_chrome(cmd, output_pdf, timeout=30)

        if not output_pdf.is_file() or output_pdf.stat().st_size == 0:
            sys.stderr.write("ERROR: Chrome failed to produce a PDF.\n")
            sys.stderr.write(f"stdout:\n{stdout}\n")
            sys.stderr.write(f"stderr:\n{stderr}\n")
            sys.exit(4)


def default_output_path(data: dict) -> Path:
    name = data.get("personal", {}).get("name") or "draft"
    slug = slugify(name)
    today = date.today().isoformat()
    return Path.home() / "Documents" / f"CV-{slug}-{today}.pdf"


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        sys.stderr.write(__doc__ or "")
        return 1

    input_path = Path(argv[1]).expanduser().resolve()
    if not input_path.is_file():
        sys.stderr.write(f"ERROR: input JSON not found: {input_path}\n")
        return 1

    data = load_data(input_path)

    if len(argv) >= 3:
        output_path = Path(argv[2]).expanduser().resolve()
    else:
        output_path = default_output_path(data)

    html = render_html(data)
    html_to_pdf(html, output_path)

    print(str(output_path))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
