"""HTTP wrapper around generate_pdf.py for Fly.io deployment.

Endpoint:
    POST /render          (Authorization: Bearer <RENDER_SHARED_SECRET>)
        body: CV JSON matching cv_schema
        → returns application/pdf
"""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_file

from generate_pdf import html_to_pdf, render_html

app = Flask(__name__)
SECRET = os.environ.get("RENDER_SHARED_SECRET", "")


@app.get("/healthz")
def healthz():
    return jsonify(ok=True)


@app.post("/render")
def render():
    if not SECRET:
        abort(500, "server misconfigured: RENDER_SHARED_SECRET unset")
    if request.headers.get("Authorization", "") != f"Bearer {SECRET}":
        abort(401)

    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        abort(400, "expected JSON object")

    # generate_pdf.load_data does its own defaults; we just hand it the dict.
    data.setdefault("personal", {})
    data.setdefault("summary", "")
    data.setdefault("education", [])
    data.setdefault("experience", [])
    data.setdefault("military", {})
    data.setdefault("volunteering", [])
    data.setdefault("skills", {})
    data.setdefault("meta", {})

    html = render_html(data)
    out = Path(tempfile.mkstemp(suffix=".pdf")[1])
    html_to_pdf(html, out)

    return send_file(
        out,
        mimetype="application/pdf",
        as_attachment=True,
        download_name="cv.pdf",
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "8080")))
