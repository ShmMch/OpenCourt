#!/usr/bin/env python3
"""Ask an AI model (Claude or Gemini) for content changes to the site and apply them.

Two stages, to keep requests small and fast:
  1. Locate: the model gets a light outline of the site (visible text only, no markup,
     styles or code) split into numbered parts, and returns which parts are relevant.
  2. Edit: the model gets only those parts, in full, and returns the file operations.
The model never runs tools. Git (commit/push) is done by the workflow.

Env:
  MODEL               claude-* or gemini-* (default claude-haiku-5-5)
  ANTHROPIC_API_KEY   required for claude-* models
  GEMINI_API_KEY      required for gemini-* models
  INSTRUCTIONS        required - what to change
  FILES               optional - space separated paths to send in full (skips stage 1)
  MAX_TOKENS          default 32000
  ANTHROPIC_VERSION   default 2023-06-01
"""
import json, os, re, subprocess, sys, urllib.request, urllib.error
from pathlib import Path

ROOT = Path.cwd()
TEXT_EXT = {".html", ".css", ".js", ".json", ".md", ".txt", ".svg", ".xml"}
SAFE_PATH = re.compile(r"^[A-Za-z0-9._\-/]+$")
CHUNK_CHARS = 2500

# Approximate list prices, USD per million tokens (input, output). Used only for the log.
PRICES = {"claude-haiku-5-5": (0.10, 0.50), "claude-sonnet-5-5": (2.0, 10.0), "claude-opus-5-5": (5.0, 25.0)}

# ---------------------------------------------------------------- schemas & prompts

LOCATE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["parts", "full_files", "note"],
    "properties": {
        "parts": {"type": "array", "items": {"type": "string"}},
        "full_files": {"type": "array", "items": {"type": "string"}},
        "note": {"type": "string"},
    },
}

LOCATE_SYSTEM = """You help update a static Hebrew (RTL) website. You are NOT making the change now.
You get the repository file list, an outline of the site split into numbered parts, and an
instruction. The outline shows only the visible text of each part (HTML tags, styles and code
are hidden; [#id] marks an element id; for JS it lists the text strings and function names;
for CSS only the selectors).
Return in "parts" the id of EVERY part whose text must change or that is needed to make the
change correctly (for example a list you must add an item to, or another place that repeats
the same fact). Be inclusive: when unsure, include the part. A change in one place often needs
matching changes elsewhere (FAQ, rules, schedule, prices, footer) - look for them.
Use "full_files" only when the change needs a whole file (e.g. restructuring code) - rarely.
"note": one short English sentence on what you found. If nothing is relevant, return empty lists."""

EDIT_SCHEMA = {
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

EDIT_SYSTEM = """You update the content of a static Hebrew (RTL) website hosted on GitHub Pages.
You receive the repository file list, the relevant parts of the files (<part> = an exact excerpt
of a file, <file> = a whole file), and an instruction.
Return ONLY the changes needed, as JSON matching the schema:
- "edit": change part of an existing file. Give "edits" as exact find/replace pairs. Each "old"
  must be copied exactly from the text you were given (including whitespace) and must appear
  only once in it - include enough surrounding text to make it unique, but keep it short.
  Set "content" to "".
- "write": create a NEW file (or fully rewrite a file you received as a whole <file>). Put the
  full file in "content", set "edits" to [].
- "delete": remove a file. Set "content" to "" and "edits" to [].
Rules: keep the existing style, HTML structure, classes, code conventions and tone of the site.
Write site content in natural Hebrew. Do not touch files under .github/. Paths are relative to
the repo root. Change only what the instruction asks for, but keep the site consistent (if a fact
changes, update every place you were given that states it). If the instruction is unclear or
cannot be done safely, return an empty "changes" list and explain in "summary".
"summary": a short Hebrew description of what you changed. "commit_message": short, English."""

# ---------------------------------------------------------------- helpers


def fail(msg):
    print(f"::error::{msg}")
    sys.exit(1)


def repo_files():
    out = subprocess.run(["git", "ls-files"], capture_output=True, text=True, check=True).stdout
    return [p for p in out.splitlines() if p and not p.startswith(".github/")]


def check_path(p):
    if not SAFE_PATH.match(p) or ".." in p.split("/") or p.startswith((".git", "/")):
        fail(f"Unsafe path from the model: {p!r}")
    if Path(p).suffix.lower() not in TEXT_EXT:
        fail(f"The model tried to change a non-text file: {p}")
    return ROOT / p


def make_chunks(path, src):
    """Split a file into consecutive parts on line boundaries. Joining them gives the file back."""
    chunks, cur, line, start = [], [], 1, 1
    for ln in src.splitlines(keepends=True):
        cur.append(ln)
        if sum(map(len, cur)) >= CHUNK_CHARS:
            chunks.append({"path": path, "lines": f"{start}-{line}", "text": "".join(cur)})
            cur, start = [], line + 1
        line += 1
    if cur:
        chunks.append({"path": path, "lines": f"{start}-{line - 1}", "text": "".join(cur)})
    return chunks


def squash(s, limit):
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= limit else s[:limit] + " …"


def outline(chunk):
    """A compact, content-only view of a part, for the locate stage."""
    s, ext = chunk["text"], Path(chunk["path"]).suffix.lower()
    if ext in (".html", ".svg", ".xml"):
        s = re.sub(r"<(script|style|svg)\b.*?(</\1>|$)", " ", s, flags=re.S | re.I)
        s = re.sub(r"<!--.*?-->", " ", s, flags=re.S)
        s = re.sub(r"""<[^>]*\bid=["']([^"']+)["'][^>]*>""", r" [#\1] ", s)
        s = re.sub(r"<[^>]*>|<[^>]*$|^[^<]*>", " ", s)
        return squash(s, 2500)
    if ext == ".js":
        names = re.findall(r"function\s+(\w+)|(?:const|let)\s+(\w+)\s*=", s)
        names = ", ".join(a or b for a, b in names)
        strs = re.findall(r"'((?:[^'\\\n]|\\.)*)'|\"((?:[^\"\\\n]|\\.)*)\"|`([^`]*)`", s)
        strs = " | ".join(x for t in strs for x in t if len(x) > 2)
        return squash((f"names: {names}. " if names else "") + f"strings: {strs}", 2500)
    if ext == ".css":
        return squash("selectors: " + ", ".join(x.strip() for x in re.findall(r"([^{}]+)\{", s)), 400)
    return squash(s, 2500)


# ---------------------------------------------------------------- model calls


def post_json(url, body, headers):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"content-type": "application/json", **headers})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        fail(f"API error {e.code}: {e.read().decode(errors='replace')[:2000]}")
    except (TimeoutError, urllib.error.URLError) as e:
        fail(f"No answer from the API ({e}). Try again.")


def call_claude(key, model, max_tokens, system, prompt, schema):
    """Returns (text, input_tokens, output_tokens)."""
    res = post_json("https://api.anthropic.com/v1/messages", {
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": prompt}],
        "output_config": {"format": {"type": "json_schema", "schema": schema}},
    }, {"x-api-key": key, "anthropic-version": os.environ.get("ANTHROPIC_VERSION") or "2023-06-01"})
    u = res.get("usage", {})
    tin = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
    tout = u.get("output_tokens", 0)
    if res.get("stop_reason") == "max_tokens":
        fail("The answer was cut off (max_tokens). Raise MAX_TOKENS.")
    if res.get("stop_reason") == "refusal":
        fail("Claude declined the request.")
    text = next((b["text"] for b in res.get("content", []) if b.get("type") == "text"), None)
    if text is None:
        fail(f"No text in Claude's answer: {json.dumps(res)[:1500]}")
    return text, tin, tout


def strip_additional(schema):
    """Gemini's schema support is narrower; validation is done in Python anyway."""
    if isinstance(schema, dict):
        return {k: strip_additional(v) for k, v in schema.items() if k != "additionalProperties"}
    if isinstance(schema, list):
        return [strip_additional(v) for v in schema]
    return schema


def gemini_stream(key, model, body):
    """Streams the answer (SSE) so a long answer never hits a read timeout."""
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse",
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json", "x-goog-api-key": key},
    )
    chunks = []
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            for raw in r:
                line = raw.decode("utf-8").strip()
                if line.startswith("data:"):
                    chunks.append(json.loads(line[5:]))
                    print(".", end="", flush=True)
    except urllib.error.HTTPError as e:
        return None, e.code, e.read().decode(errors="replace")
    except (TimeoutError, urllib.error.URLError) as e:
        fail(f"Gemini stopped responding ({e}). Try again.")
    print()
    return chunks, 200, ""


def call_gemini(key, model, max_tokens, system, prompt, schema):
    """Returns (text, input_tokens, output_tokens)."""
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "responseMimeType": "application/json",
            "responseJsonSchema": strip_additional(schema),
            # Low thinking = faster and fewer tokens; streamed thoughts keep the connection alive.
            "thinkingConfig": {"thinkingLevel": "low", "includeThoughts": True},
        },
    }
    chunks, code, err = gemini_stream(key, model, body)
    if chunks is None and code == 400 and "thinking" in err.lower():
        print("Model does not accept thinkingConfig, retrying without it")
        del body["generationConfig"]["thinkingConfig"]
        chunks, code, err = gemini_stream(key, model, body)
    if chunks is None:
        fail(f"API error {code}: {err[:2000]}")

    text, reason, u = [], None, {}
    for c in chunks:
        u = c.get("usageMetadata") or u
        for cand in c.get("candidates") or []:
            reason = cand.get("finishReason") or reason
            for part in cand.get("content", {}).get("parts", []):
                if not part.get("thought") and "text" in part:
                    text.append(part["text"])
    tin = u.get("promptTokenCount", 0)
    tout = u.get("candidatesTokenCount", 0) + u.get("thoughtsTokenCount", 0)
    if not chunks or (reason is None and not text):
        fail(f"Gemini returned no answer: {json.dumps(chunks[-1] if chunks else {})[:1500]}")
    if reason == "MAX_TOKENS":
        fail("The answer was cut off (max tokens). Raise MAX_TOKENS.")
    if reason not in (None, "STOP"):
        fail(f"Gemini stopped early: {reason}")
    text = "".join(text)
    if not text:
        fail("No text in Gemini's answer.")
    return text, tin, tout


class Model:
    def __init__(self, name, key, max_tokens):
        self.name, self.key, self.max_tokens = name, key, max_tokens
        self.fn = call_gemini if name.startswith("gemini") else call_claude
        self.tin = self.tout = 0

    def ask(self, stage, system, prompt, schema, max_tokens=None):
        print(f"[{stage}] sending {len(prompt):,} chars")
        text, tin, tout = self.fn(self.key, self.name, max_tokens or self.max_tokens, system, prompt, schema)
        self.tin += tin
        self.tout += tout
        print(f"[{stage}] tokens in {tin:,}, out {tout:,}")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            fail(f"[{stage}] The answer is not valid JSON: {text[:1500]}")

    def cost(self):
        pin, pout = PRICES.get(self.name, (0, 0))
        if pin:
            return f" ≈ ${(self.tin * pin + self.tout * pout) / 1e6:.4f}"
        return " (free tier: $0)" if self.name.startswith("gemini") else ""


# ---------------------------------------------------------------- applying changes


def validate(plan):
    if not isinstance(plan, dict) or not isinstance(plan.get("changes"), list):
        fail(f"Unexpected answer shape: {json.dumps(plan, ensure_ascii=False)[:1500]}")
    plan.setdefault("summary", "")
    plan.setdefault("commit_message", "")
    for ch in plan["changes"]:
        if not isinstance(ch, dict) or ch.get("action") not in ("edit", "write", "delete") or not isinstance(ch.get("path"), str):
            fail(f"Invalid change: {json.dumps(ch, ensure_ascii=False)[:500]}")
        ch.setdefault("content", "")
        ch.setdefault("edits", [])
        for e in ch["edits"]:
            if not isinstance(e, dict) or not isinstance(e.get("old"), str) or not isinstance(e.get("new"), str) or not e["old"]:
                fail(f"Invalid edit in {ch['path']}: {json.dumps(e, ensure_ascii=False)[:500]}")
    return plan


def apply_edits(path, parts, sent, edits):
    """parts: the file split into chunks; sent: which chunks the model saw.
    An edit must match exactly once in what the model saw; if it spans two chunks,
    it must match exactly once in the whole file."""
    parts, sent = list(parts), list(sent)
    for e in edits:
        old, new = e["old"], e["new"]
        hits = [i for i, (p, s) in enumerate(zip(parts, sent)) if s for _ in range(p.count(old))]
        if len(hits) == 1:
            i = hits[0]
            parts[i] = parts[i].replace(old, new, 1)
            continue
        whole = "".join(parts)
        if not hits and whole.count(old) == 1:
            parts, sent = [whole.replace(old, new, 1)], [True]
            continue
        n = len(hits) or whole.count(old)
        fail(f"{path}: text to replace was found {n} times (must be exactly 1):\n{old[:300]}")
    return "".join(parts)


# ---------------------------------------------------------------- main


def main():
    name = os.environ.get("MODEL") or "claude-haiku-5-5"
    gemini = name.startswith("gemini")
    key = os.environ.get("GEMINI_API_KEY" if gemini else "ANTHROPIC_API_KEY", "").strip()
    instructions = os.environ.get("INSTRUCTIONS", "").strip()
    if not key:
        fail(f"No API key. Add the {'GEMINI_API_KEY' if gemini else 'ANTHROPIC_API_KEY'} secret or fill the api_key input.")
    if not instructions:
        fail("No instructions given.")
    model = Model(name, key, int(os.environ.get("MAX_TOKENS") or 32000))

    all_files = repo_files()
    site_files = [p for p in all_files if Path(p).suffix.lower() in TEXT_EXT and (ROOT / p).is_file()]
    chunks = {}  # id -> chunk
    by_file = {}  # path -> [ids in order]
    for p in site_files:
        for c in make_chunks(p, (ROOT / p).read_text(encoding="utf-8")):
            cid = f"p{len(chunks) + 1}"
            chunks[cid] = c
            by_file.setdefault(p, []).append(cid)
    file_list = "# Files in the repository\n" + "\n".join(all_files)
    print(f"Model: {name} | {len(site_files)} site files, {len(chunks)} parts")

    # ---- stage 1: locate (skipped when FILES is given)
    wanted = os.environ.get("FILES", "").split()
    for p in wanted:
        if p not in by_file:
            fail(f"File not found: {p}")
    selected, full = set(), set(wanted)
    if not wanted:
        outline_txt = "\n".join(
            f'<part id="{cid}" file="{c["path"]}" lines="{c["lines"]}">{outline(c)}</part>'
            for cid, c in chunks.items()
        )
        loc = model.ask("locate", LOCATE_SYSTEM,
                        f"{file_list}\n\n# Site outline\n{outline_txt}\n\n# Instruction\n{instructions}",
                        LOCATE_SCHEMA, max_tokens=4000)
        if not isinstance(loc, dict):
            fail(f"[locate] Unexpected answer: {loc}")
        selected = {c for c in loc.get("parts", []) if c in chunks}
        full = {p for p in loc.get("full_files", []) if p in by_file}
        print(f"[locate] {loc.get('note', '')}")
        print(f"[locate] parts: {' '.join(sorted(selected, key=lambda x: int(x[1:]))) or '-'}"
              f" | full files: {' '.join(sorted(full)) or '-'}")
        if not selected and not full:
            fail(f"Could not find anything relevant to change. {loc.get('note', '')}")

    # ---- stage 2: edit
    for p in full:
        selected.update(by_file[p])
    blocks = []
    for p in site_files:
        if p in full:
            blocks.append(f'<file path="{p}">\n{(ROOT / p).read_text(encoding="utf-8")}\n</file>')
        else:
            for cid in by_file[p]:
                if cid in selected:
                    c = chunks[cid]
                    blocks.append(f'<part file="{p}" lines="{c["lines"]}">\n{c["text"]}\n</part>')
    plan = validate(model.ask("edit", EDIT_SYSTEM,
                              f"{file_list}\n\n# Relevant content\n" + "\n\n".join(blocks)
                              + f"\n\n# Instruction\n{instructions}", EDIT_SCHEMA))

    # Validate everything before touching any file, so a bad answer changes nothing.
    staged = []
    for ch in plan["changes"]:
        path, rel = check_path(ch["path"]), ch["path"]
        if ch["action"] == "delete":
            if not path.is_file():
                fail(f"Cannot delete missing file: {rel}")
            staged.append((ch, path, None))
        elif ch["action"] == "write":
            if path.is_file() and rel not in full:
                fail(f"The model tried to rewrite {rel} without seeing all of it. Run again with files: {rel}")
            staged.append((ch, path, ch["content"]))
        else:  # edit
            if rel not in by_file:
                fail(f"Cannot edit missing file: {rel}")
            ids = by_file[rel]
            staged.append((ch, path, apply_edits(rel, [chunks[i]["text"] for i in ids],
                                                 [i in selected for i in ids], ch["edits"])))

    for ch, path, new in staged:
        if new is None:
            path.unlink()
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(new, encoding="utf-8")
        print(f"  {ch['action']:6} {ch['path']}")

    cost = model.cost()
    print(f"\nTotal tokens: in {model.tin:,}, out {model.tout:,}{cost}")
    print(plan["summary"])
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        msg = plan["commit_message"].strip().splitlines()[0] if plan["commit_message"].strip() else "Update site content"
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"commit_message={msg[:100]}\nchanged={'true' if staged else 'false'}\n")
    summ = os.environ.get("GITHUB_STEP_SUMMARY")
    if summ:
        with open(summ, "a", encoding="utf-8") as f:
            f.write(f"## עדכון אוטומטי של האתר\n\n**בקשה:** {instructions}\n\n{plan['summary']}\n\n")
            f.write("".join(f"- `{ch['action']}` {ch['path']}\n" for ch, _, _ in staged) or "_לא בוצעו שינויים_\n")
            f.write(f"\n`{name}` · tokens in {model.tin:,} / out {model.tout:,}{cost}\n")


if __name__ == "__main__":
    main()
