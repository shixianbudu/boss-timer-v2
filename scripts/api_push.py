"""通过 GitHub Git Data API 推送文件（绕开 github.com:443 的 git 端口封锁）。

用法: python scripts/api_push.py <branch> <本地根目录> <相对路径1> [相对路径2 ...]
流程: 取远端 HEAD -> 上传 blob(base64) -> 基于 HEAD 建 tree -> 建 commit -> 更新 ref
"""
import base64
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

OWNER, REPO = "shixianbudu", "boss-timer"
API = f"https://api.github.com/repos/{OWNER}/{REPO}/git"


def get_token() -> str:
    env = dict(os.environ)
    env["GIT_TERMINAL_PROMPT"] = "0"
    r = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True,
        text=True,
        env=env,
        timeout=30,
    )
    for line in r.stdout.splitlines():
        if line.startswith("password="):
            return line[len("password="):]
    raise RuntimeError("未获取到 GitHub 凭据: " + r.stderr[:200])


def req(token: str, method: str, url: str, payload: dict | None = None) -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Authorization", f"Bearer {token}")
    r.add_header("Accept", "application/vnd.github+json")
    r.add_header("X-GitHub-Api-Version", "2022-11-28")
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode())


def main() -> None:
    branch = sys.argv[1]
    root = Path(sys.argv[2])
    files = sys.argv[3:]
    token = get_token()

    head = req(token, "GET", f"{API}/ref/heads/{branch}")["object"]["sha"]
    print(f"{branch} 远端 HEAD: {head[:8]}")

    tree_items = []
    for rel in files:
        content = (root / rel).read_bytes()
        blob = req(token, "POST", f"{API}/blobs", {
            "content": base64.b64encode(content).decode(),
            "encoding": "base64",
        })
        tree_items.append({"path": rel.replace("\\", "/"), "mode": "100644", "type": "blob", "sha": blob["sha"]})
        print(f"  blob 已上传: {rel} ({len(content)} bytes)")

    tree = req(token, "POST", f"{API}/trees", {"base_tree": head, "tree": tree_items})
    commit = req(token, "POST", f"{API}/commits", {
        "message": "feat: 全部Boss总览标签页 + 顶部抖音水印（API 推送，网络绕行）",
        "tree": tree["sha"],
        "parents": [head],
    })
    req(token, "PATCH", f"{API}/refs/heads/{branch}", {"sha": commit["sha"]})
    print(f"{branch} 已更新 -> {commit['sha'][:8]}")


if __name__ == "__main__":
    main()
