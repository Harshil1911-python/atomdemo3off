from flask import Flask, render_template, jsonify, send_from_directory
import os

app = Flask(__name__)

@app.after_request
def _headers(resp):
    ct = resp.content_type or ""
    if "text/html" in ct:
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    return resp


def spa():
    return render_template("index.html")


@app.route("/")
@app.route("/billing")
@app.route("/calculator")
@app.route("/proprietor")
@app.route("/accountant")
def home():
    return spa()


@app.route("/api/health")
def health():
    return jsonify(status="ok", app="Atom Bills", mode="spa", offline=True)


@app.route("/manifest.webmanifest")
def manifest():
    r = send_from_directory("static", "manifest.webmanifest", mimetype="application/manifest+json")
    r.headers["Cache-Control"] = "no-cache"
    r.headers["Content-Type"] = "application/manifest+json"
    return r


@app.route("/sw.js")
def service_worker():
    r = send_from_directory("static", "sw.js", mimetype="application/javascript")
    r.headers["Cache-Control"] = "no-cache, max-age=0"
    r.headers["Service-Worker-Allowed"] = "/"
    return r


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
