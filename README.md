# cartrige

**Share Claude Code agent skills as PNG images.**

A "cartridge" is a normal PNG with a `SKILL.md` (or any other text) appended after its `IEND` chunk. The image still renders in any viewer, browser, or chat client — but extract the bytes after `IEND` and you get the full skill back, ready to drop into `~/.claude/skills/`.

Post the PNG in Slack, attach it to a Telegram message, drag it into a GitHub issue, embed it in a blog post. Anyone who downloads the image can extract and install the skill.

## Why ship skills inside images?

- **Survives anywhere images go.** Slack, Discord, Telegram, GitHub, email, Notion — all of them strip or sandbox `.md` and `.txt` attachments differently, but PNGs flow through everything untouched.
- **Self-illustrating.** The image itself can show what the skill does — a screenshot, logo, or diagram — and carry the skill that does it.
- **Zero packaging.** No tarball, no zip, no install script. One file is the demo *and* the payload.
- **No trust ceremony.** The recipient can `cat`/extract the payload, read the skill, and decide whether to install it — no opaque blob.

This is **not** encryption or steganography. The payload is plainly visible to anyone who looks at the file bytes. If your skill contains secrets, don't ship it as a cartridge.

## How it works

Every valid PNG ends with an 8-byte `IEND` chunk:

```
49 45 4E 44 AE 42 60 82
```

PNG decoders stop reading at `IEND`. Bytes after that sequence are ignored by image viewers but preserved on disk — so we append the `SKILL.md` there.

## Files

| File | Purpose |
| --- | --- |
| `cart.png` | The blank carrier image |
| `cart_cartridge.png` | Example cartridge — carries the `cartridge-read-write` skill itself |
| `skills/cartridge-read-write/SKILL.md` | The skill, in its installable form |

## Receiving a skill

You got a cartridge PNG. Install the skill from it:

### PowerShell

```powershell
$png = "cart_cartridge.png"
$out = "$env:USERPROFILE\.claude\skills\cartridge-read-write\SKILL.md"
$b = [System.IO.File]::ReadAllBytes((Resolve-Path $png))
$s = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($b)
$marker = [string]([char]0x49 + [char]0x45 + [char]0x4E + [char]0x44 + [char]0xAE + [char]0x42 + [char]0x60 + [char]0x82)
$idx = $s.LastIndexOf($marker)
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
[System.IO.File]::WriteAllBytes($out, $b[($idx + 8)..($b.Length - 1)])
```

### Python

```python
import os, pathlib
data = open("cart_cartridge.png", "rb").read()
payload = data[data.rfind(b"IEND\xae\x42\x60\x82") + 8:]
out = pathlib.Path.home() / ".claude" / "skills" / "cartridge-read-write" / "SKILL.md"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(payload)
```

Restart your Claude Code session — the skill is now available.

## Shipping a skill

You wrote a skill and want to share it as a PNG:

### PowerShell

```powershell
$carrier = "cart.png"                                  # any PNG you want as the cover
$skill   = "skills/my-skill/SKILL.md"
$out     = "my-skill.cartridge.png"

Copy-Item $carrier $out -Force
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path $skill))
$fs = [System.IO.File]::Open((Resolve-Path $out), "Append")
$fs.Write($bytes, 0, $bytes.Length)
$fs.Close()
```

### Python

```python
import shutil
shutil.copyfile("cart.png", "my-skill.cartridge.png")
with open("my-skill.cartridge.png", "ab") as out:
    out.write(open("skills/my-skill/SKILL.md", "rb").read())
```

Then post `my-skill.cartridge.png` wherever you want to share it.

## The bundled skill

`skills/cartridge-read-write/SKILL.md` is a Claude Code skill that teaches an agent to read and write cartridges. Install it, then ask Claude things like:

- "embed this skill in cart.png"
- "what's hidden in cart_cartridge.png?"
- "extract the payload from this PNG and install it as a skill"

### Gotcha for agents

The snippets in the skill use `$variables`. If you invoke them via `bash -c "powershell -Command \"...$var...\""`, bash eats every `$var` before PowerShell sees it (turning `$i--` into `--` and crashing the parser). Either call PowerShell directly, single-quote the `-Command` argument, or run from a `.ps1` file.

## Notes

- Use UTF-8 if your skill contains non-ASCII characters.
- Do **not** use `Add-Content` / `Set-Content` for the append — they re-encode and corrupt the PNG. Use `[System.IO.File]::Open(..., "Append")` (PowerShell) or `"ab"` mode (Python).
- The byte sequence `49 45 4E 44 AE 42 60 82` only appears once in a valid PNG (as the trailing chunk), so the split is unambiguous.
- Larger skills make larger PNGs. Most chat platforms accept multi-MB images without complaint.

## License

MIT
