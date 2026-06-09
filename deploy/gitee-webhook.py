#!/usr/bin/env python3
"""Gitee WebHook 接收器：收到 push 事件后触发 deploy/gitee-deploy.sh"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse

PORT = int(os.environ.get("GITEE_WEBHOOK_PORT", "9000"))
SECRET = os.environ.get("GITEE_WEBHOOK_SECRET", "").strip()
APP_DIR = os.environ.get("LEZYOU_APP_DIR", "/opt/lezyou")
DEPLOY_SCRIPT = os.path.join(APP_DIR, "deploy", "gitee-deploy.sh")
LOG_FILE = os.environ.get("DEPLOY_LOG", "/var/log/lezyou-gitee-deploy.log")


def log(msg: str) -> None:
    line = f"[webhook] {msg}\n"
    sys.stdout.write(line)
    sys.stdout.flush()
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line)
    except OSError:
        pass


def authorized(path: str, headers: dict[str, str]) -> bool:
    if not SECRET:
        return False
    qs = parse_qs(urlparse(path).query)
    token = qs.get("token", [""])[0]
    if token == SECRET:
        return True
    header_token = headers.get("X-Gitee-Token") or headers.get("X-Git-Token") or ""
    return header_token == SECRET


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args) -> None:
        log(fmt % args)

    def do_POST(self) -> None:
        if not authorized(self.path, {k: v for k, v in self.headers.items()}):
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"forbidden")
            log("拒绝：token 不匹配")
            return

        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        try:
            payload = json.loads(body.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            payload = {}

        hook_name = payload.get("hook_name") or payload.get("zen") or "unknown"
        ref = payload.get("ref", "")
        log(f"收到事件 hook={hook_name} ref={ref}")

        # 仅 push 到 main/master 时部署
        if ref and ref not in ("refs/heads/main", "refs/heads/master"):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"skipped: not main branch")
            log(f"跳过非主分支: {ref}")
            return

        if not os.path.isfile(DEPLOY_SCRIPT):
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"missing deploy script")
            log(f"ERROR: 找不到 {DEPLOY_SCRIPT}")
            return

        subprocess.Popen(
            ["/bin/bash", DEPLOY_SCRIPT],
            cwd=APP_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )

        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"deploy started")

    def do_GET(self) -> None:
        if self.path.rstrip("/") == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
            return
        self.send_response(404)
        self.end_headers()


def main() -> None:
    if not SECRET:
        sys.stderr.write("请设置环境变量 GITEE_WEBHOOK_SECRET\n")
        sys.exit(1)
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    log(f"监听 0.0.0.0:{PORT} app={APP_DIR}")
    server.serve_forever()


if __name__ == "__main__":
    main()
