#!/usr/bin/env python3.11
"""Browser-level runtime check for P1.1 third-party material copy success.

This script launches a temporary headless Chromium session against the local dev
server, opens the Article Publishing Workbench, clicks the first visible third-party
material copy button, and asserts the success toast text appears in the DOM.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

import websocket

PORT = 9222
ORIGIN = "http://127.0.0.1:3000"
URL = f"{ORIGIN}/articles"
SUCCESS_TEXT = "已复制平台素材"
OUTPUT_PATH = Path("p11_clipboard_runtime_evidence.json")


def wait_for_json(url: str, timeout: float = 10.0):
    deadline = time.time() + timeout
    last_error = None
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=1.0) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            time.sleep(0.2)
    raise RuntimeError(f"Timed out waiting for {url}: {last_error}")


class Cdp:
    def __init__(self, ws_url: str):
        self.ws = websocket.create_connection(ws_url, timeout=5, suppress_origin=True)
        self.next_id = 1

    def call(self, method: str, params: dict | None = None, timeout: float = 8.0):
        message_id = self.next_id
        self.next_id += 1
        self.ws.send(json.dumps({"id": message_id, "method": method, "params": params or {}}))
        deadline = time.time() + timeout
        while time.time() < deadline:
            raw = self.ws.recv()
            data = json.loads(raw)
            if data.get("id") == message_id:
                if "error" in data:
                    raise RuntimeError(f"CDP {method} failed: {data['error']}")
                return data.get("result")
        raise RuntimeError(f"Timed out waiting for CDP response: {method}")

    def close(self):
        self.ws.close()


def evaluate(cdp: Cdp, expression: str, timeout: float = 8.0):
    result = cdp.call(
        "Runtime.evaluate",
        {
            "expression": expression,
            "awaitPromise": True,
            "returnByValue": True,
        },
        timeout=timeout,
    )
    remote = result.get("result", {})
    if "exceptionDetails" in result:
        raise RuntimeError(f"Runtime exception: {result['exceptionDetails']}")
    return remote.get("value")


def wait_until(cdp: Cdp, expression: str, timeout: float = 15.0, interval: float = 0.25):
    deadline = time.time() + timeout
    last_value = None
    while time.time() < deadline:
        last_value = evaluate(cdp, expression)
        if last_value:
            return last_value
        time.sleep(interval)
    raise RuntimeError(f"Condition did not become true: {expression}; last={last_value!r}")


def main() -> None:
    chromium = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
    if not chromium:
        raise RuntimeError("Chromium executable not found")

    user_data_dir = "/home/ubuntu/.browser_data_dir"
    proc = None
    try:
        wait_for_json(f"http://127.0.0.1:{PORT}/json/list", timeout=2)
    except Exception:
        proc = subprocess.Popen(
            [
                chromium,
                "--headless=new",
                "--no-sandbox",
                "--disable-gpu",
                f"--remote-debugging-port={PORT}",
                "--remote-allow-origins=*",
                f"--user-data-dir={user_data_dir}",
                f"--unsafely-treat-insecure-origin-as-secure={ORIGIN}",
                "--enable-experimental-web-platform-features",
                "about:blank",
            ],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    evidence: dict[str, object] = {
        "url": URL,
        "successText": SUCCESS_TEXT,
        "runtime": "chromium-cdp",
    }
    try:
        targets = wait_for_json(f"http://127.0.0.1:{PORT}/json/list")
        page_target = next((target for target in targets if target.get("type") == "page" and target.get("webSocketDebuggerUrl")), None)
        if not page_target:
            raise RuntimeError(f"No debuggable page target found: {targets}")
        cdp = Cdp(page_target["webSocketDebuggerUrl"])
        try:
            cdp.call("Page.enable")
            cdp.call("Runtime.enable")
            try:
                cdp.call("Browser.grantPermissions", {"origin": ORIGIN, "permissions": ["clipboardReadWrite", "clipboardSanitizedWrite"]})
            except Exception:
                pass
            cdp.call("Page.navigate", {"url": URL})
            wait_until(cdp, "document.readyState === 'complete'", timeout=20)
            wait_until(cdp, "document.body && document.body.innerText.includes('第三方平台素材')", timeout=20)
            wait_until(cdp, "Array.from(document.querySelectorAll('button')).some((el) => el.innerText.trim() === '复制' && !el.disabled)", timeout=20)

            button_info = evaluate(
                cdp,
                """
                (() => {
                  const buttons = Array.from(document.querySelectorAll('button'));
                  const button = buttons.find((el) => el.innerText.trim() === '复制' && !el.disabled);
                  if (!button) return null;
                  button.scrollIntoView({ block: 'center', inline: 'center' });
                  const rect = button.getBoundingClientRect();
                  return { text: button.innerText.trim(), x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
                })()
                """,
            )
            if not button_info:
                raise RuntimeError("No visible third-party material copy button found")

            cdp.call("Input.dispatchMouseEvent", {"type": "mouseMoved", "x": button_info["x"], "y": button_info["y"], "button": "left"})
            cdp.call("Input.dispatchMouseEvent", {"type": "mousePressed", "x": button_info["x"], "y": button_info["y"], "button": "left", "clickCount": 1})
            cdp.call("Input.dispatchMouseEvent", {"type": "mouseReleased", "x": button_info["x"], "y": button_info["y"], "button": "left", "clickCount": 1})

            toast_seen = wait_until(cdp, f"document.body && document.body.innerText.includes('{SUCCESS_TEXT}')", timeout=8)
            clipboard_text = evaluate(cdp, "navigator.clipboard.readText().catch(() => '')", timeout=8)
            evidence.update(
                {
                    "copyButton": button_info,
                    "successToastSeen": bool(toast_seen),
                    "clipboardTextLength": len(clipboard_text or ""),
                    "clipboardTextPreview": (clipboard_text or "")[:160],
                    "clipboardNonEmpty": bool(clipboard_text),
                }
            )
            if not evidence["successToastSeen"]:
                raise RuntimeError("Copy success toast was not observed")
            if not evidence["clipboardNonEmpty"]:
                raise RuntimeError("Clipboard content was empty after copy")
        finally:
            cdp.close()
    finally:
        if proc is not None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
            if str(user_data_dir).startswith("/tmp/p11-clipboard-chrome-"):
                shutil.rmtree(user_data_dir, ignore_errors=True)

    OUTPUT_PATH.write_text(json.dumps(evidence, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(evidence, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
