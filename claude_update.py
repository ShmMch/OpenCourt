#!/usr/bin/env python3
"""Ask Claude for content changes to the site and apply them to the working tree.

Claude only returns a JSON list of file operations. Git (commit/push) is done by
the workflow, so we never pay for Claude to run tools or loop.

Env:
  ANTHROPIC_API_KEY   required
  INSTRUCTIONS        required - what to change
  MODEL               default claude-sonnet-5-5
  FILES               optional - space separated paths to send. Empty = all site files
  MAX_TOKENS          default 32000
  ANTHROPIC_VERSION   default 2023-06-01
"""
import json, os, re, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path.cwd()
TEXT_EXT = {".html", ".css", ".js", ".json", ".md", ".txt", ".svg", ".xml"}
SAFE_PATH = re.compile(r"^[A-Za-z0-9._\-/]+$")

# Approximate list prices, USD per million tokens (input, output). Used only for the log.
PRICES = {"claude-haiku-5-5": (0.10, 0.50), "claude-sonnet-5-5": (2.0, 10.0), "claude-opus-5-5": (5.0, 25.0)}

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["summary", "commit_message", "changes"],
    "properties": {
        "summary": {"type": "string"},
        "commit_message": {"type": "string"},
        "changes": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["action", "path", "content", "edits"],
                "properties": {
                    "action": {"type": "string", "enum": ["edit", "write", "delete"]},
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                    "edits": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["old", "new"],
                            "properties": {"old": {"type": "string"}, "new": {"type": "string"}},
                        },
                    },
                },
            },
        },
    },
}

SYSTEM = """You update the content of a static Hebrew (RTL) website hosted on GitHub Pages.
You receive the repository file list, the contents of the relevant files, and an instruction.
Return ONLY the changes needed, as JSON matching the schema:
- "edit": change part of an existing file. Give "edits" as exact find/replace pairs. Each "old"
  must be copied exactly from the file (including whitespace) and must appear exactly once -
  include enough surrounding text to make it unique. Prefer "edit" for any existing file:
  it is much cheaper than rewriting the whole file. Set "content" to "".
- "write": create a new file, or fully rewrite a small file. Put the full file in "content",
  set "edits" to [].
- "delete": remove a file. Set "content" to "" and "edits" to [].
Rules: keep the existing style, structure, code conventions and tone of the site. Write site
content in natural Hebrew. Do not touch files under .github/. Paths are relative to the repo
root. Change only what the instruction asks for. If the instruction is unclear or cannot be done
safely, return an empty "changes" list and explain in "summary".
"summary": a short Hebrew description of what you changed. "commit_message": short, English."""


def fail(msg):
    print(f"::error::{msg}")
    sys.exit(1)


def repo_files():
    out = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True).stdout
    return [p for p in out.splitlines() if p and not p.startswith(".github/")]


def check_path(p):
    if not SAFE_PATH.match(p) or ".." in p.split("/") or p.startswith((".git", "/")):
        fail(f"Unsafe path from Claude: {p!r}")
    if Path(p).suffix.lower() not in TEXT_EXT:
        fail(f"Claude tried to change a non-text file: {p}")
    return ROOT / p


def call_claude(key, model, max_tokens, prompt):
    body = {
        "model": model,
        "max_tokens": max_tokens,
        "system": SYSTEM,
        "messages": [{"role": "user", "content": prompt}],
        "output_config": {"format": {"type": "json_schema", "schema": SCHEMA}},
    }
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps(body).encode(),
        headers={
            "content-type": "application/json",
            "x-api-key": key,
            "anthropic-version": os.environ.get("ANTHROPIC_VERSION") or "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        fail(f"Claude API error {e.code}: {e.read().decode(errors='replace')[:2000]}")


def main():
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    instructions = os.environ.get("INSTRUCTIONS", "").strip()
    model = os.environ.get("MODEL") or "claude-sonnet-5-5"
    max_tokens = int(os.environ.get("MAX_TOKENS") or 32000)
    if not key:
        fail("No API key. Add the ANTHROPIC_API_KEY secret or fill the api_key input.")
    if not instructions:
        fail("No instructions given.")

    all_files = repo_files()
    wanted = os.environ.get("FILES", "").split()
    send = wanted or [p for p in all_files if Path(p).suffix.lower() in TEXT_EXT]
    for p in send:
        if not (ROOT / p).is_file():
            fail(f"File not found: {p}")

    parts = ["# Files in the repository\n" + "\n".join(all_files)]
    for p in send:
        parts.append(f'<file path="{p}">\n{(ROOT / p).read_text(encoding="utf-8")}\n</file>')
    parts.append("# Instruction\n" + instructions)
    print(f"Model: {model} | sending {len(send)} files: {' '.join(send)}")

    res = call_claude(key, model, max_tokens, "\n\n".join(parts))

    u = res.get("usage", {})
    tin = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
    tout = u.get("output_tokens", 0)
    pin, pout = PRICES.get(model, (0, 0))
    cost = f" ≈ ${(tin * pin + tout * pout) / 1e6:.3f}" if pin else ""
    print(f"Tokens: in {tin}, out {tout}{cost}")

    if res.get("stop_reason") == "max_tokens":
        fail("Claude's answer was cut off (max_tokens). Raise max_tokens or send fewer files.")
    if res.get("stop_reason") == "refusal":
        fail("Claude declined the request.")
    text = next((b["text"] for b in res.get("content", []) if b.get("type") == "text"), None)
    if text is None:
        fail(f"No text in Claude's answer: {json.dumps(res)[:1500]}")
    try:
        plan = json.loads(text)
    except json.JSONDecodeError:
        fail(f"Claude's answer is not valid JSON: {text[:1500]}")

    # Validate everything before touching any file, so a bad answer changes nothing.
    staged = []
    for ch in plan["changes"]:
        path = check_path(ch["path"])
        if ch["action"] == "delete":
            if not path.is_file():
                fail(f"Cannot delete missing file: {ch['path']}")
            staged.append((ch, path, None))
        elif ch["action"] == "write":
            staged.append((ch, path, ch["content"]))
        else:  # edit
            if not path.is_file():
                fail(f"Cannot edit missing file: {ch['path']}")
            src = path.read_text(encoding="utf-8")
            for e in ch["edits"]:
                n = src.count(e["old"])
                if n != 1:
                    fail(f"{ch['path']}: text to replace was found {n} times (must be exactly 1):\n{e['old'][:300]}")
                src = src.replace(e["old"], e["new"], 1)
            staged.append((ch, path, src))

    for ch, path, new in staged:
        if new is None:
            path.unlink()
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(new, encoding="utf-8")
        print(f"  {ch['action']:6} {ch['path']}")

    print("\n" + plan["summary"])
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        msg = plan["commit_message"].strip().splitlines()[0] if plan["commit_message"].strip() else "Update site content"
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"commit_message={msg[:100]}\nchanged={'true' if staged else 'false'}\n")
    summ = os.environ.get("GITHUB_STEP_SUMMARY")
    if summ:
        with open(summ, "a", encoding="utf-8") as f:
            f.write(f"## עדכון מ-Claude\n\n**בקשה:** {instructions}\n\n{plan['summary']}\n\n")
            f.write("".join(f"- `{ch['action']}` {ch['path']}\n" for ch, _, _ in staged) or "_לא בוצעו שינויים_\n")
            f.write(f"\n`{model}` · tokens in {tin} / out {tout}{cost}\n")


if __name__ == "__main__":
    main()
