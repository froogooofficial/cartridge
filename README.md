# cartrige

**Share Claude Code agent skills as images.**

A "cartridge" is a normal PNG or JPEG/JFIF with a `SKILL.md` (or any other text) appended after the image's end marker. The image still renders in any viewer, browser, or chat client — but extract the trailing bytes and you get the full skill back, ready to drop into `~/.claude/skills/`.

Post the image in Slack, attach it to a Telegram message, drag it into a GitHub issue, **tweet it on X**. Anyone who downloads it can extract and install the skill.

## Why ship skills inside images?

- **Survives anywhere images go.** Slack, Discord, Telegram, GitHub, email, Notion, X/Twitter — all of them strip or sandbox `.md` and `.txt` attachments differently, but images flow through everything.
- **Self-illustrating.** The image can show what the skill does — a screenshot, logo, or diagram — and carry the skill that does it.
- **Zero packaging.** No tarball, no zip, no install script. One file is the demo *and* the payload.
- **No trust ceremony.** The recipient can extract the payload, read it, and decide whether to install — no opaque blob.

This is **not** encryption or steganography. The payload is plainly visible to anyone who looks at the file bytes. If your skill contains secrets, don't ship it as a cartridge.

## Supported formats

| Format | Magic | End marker | Skip after marker |
| --- | --- | --- | --- |
| **PNG** | `89 50 4E 47` | `49 45 4E 44 AE 42 60 82` (IEND + CRC) | 8 bytes |
| **JPEG / JFIF** | `FF D8 FF` | `FF D9` (EOI) | 2 bytes |

`.jpg`, `.jpeg`, and `.jfif` are all the same byte format — only the extension differs. **Use JFIF when sharing on X/Twitter** (see below).

## Files in this repo

| File | Purpose |
| --- | --- |
| `cart.png` | Blank PNG carrier |
| `cart_cartridge.png` | Demo cartridge — PNG carrying the `cartridge-read-write` skill |
| `HIdklBCWUAAD91V.jfif` | Blank JFIF carrier |
| `HIdklBCWUAAD91V_cartridge.jfif` | Demo cartridge — JFIF carrying the skill |
| `skills/cartridge-read-write/SKILL.md` | The skill, in installable form |

## Receiving a skill (auto-detect PNG or JPEG)

### PowerShell

```powershell
$path = "cart_cartridge.png"   # or HIdklBCWUAAD91V_cartridge.jfif
$out  = "$env:USERPROFILE\.claude\skills\cartridge-read-write\SKILL.md"

$b = [System.IO.File]::ReadAllBytes((Resolve-Path $path))
$s = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($b)

if     ($b[0] -eq 0x89 -and $b[1] -eq 0x50) { $marker = [string]([char]0x49+[char]0x45+[char]0x4E+[char]0x44+[char]0xAE+[char]0x42+[char]0x60+[char]0x82); $skip = 8 }
elseif ($b[0] -eq 0xFF -and $b[1] -eq 0xD8) { $marker = [string]([char]0xFF+[char]0xD9); $skip = 2 }
else   { throw "Not a PNG or JPEG file" }

$idx = $s.LastIndexOf($marker)
New-Item -ItemType Directory -Force -Path (Split-Path $out) | Out-Null
[System.IO.File]::WriteAllBytes($out, $b[($idx + $skip)..($b.Length - 1)])
```

### Python

```python
import pathlib

def extract(path):
    data = open(path, "rb").read()
    if   data[:2] == b"\x89P":      marker, skip = b"IEND\xae\x42\x60\x82", 8
    elif data[:2] == b"\xff\xd8":   marker, skip = b"\xff\xd9", 2
    else: raise ValueError("Not a PNG or JPEG file")
    return data[data.rfind(marker) + skip:]

out = pathlib.Path.home() / ".claude" / "skills" / "cartridge-read-write" / "SKILL.md"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_bytes(extract("cart_cartridge.png"))
```

Restart your Claude Code session — the skill is now available.

## Shipping a skill

Appending is format-agnostic — the same code works for PNG or JPEG/JFIF.

### PowerShell

```powershell
$carrier = "cart.png"                        # any PNG or JPEG
$skill   = "skills/my-skill/SKILL.md"
$out     = "my-skill.cartridge.png"          # match the carrier's extension

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

## Sharing on X/Twitter — convert to JFIF first

X often re-encodes uploaded PNGs to JPEG, which **destroys the cartridge**. If you upload an already-JPEG file that fits within X's size/quality budget, it's more likely to pass through unchanged. Convert your PNG carrier to JFIF before embedding the skill.

### PowerShell (no external tools)

```powershell
Add-Type -AssemblyName System.Drawing
$src = "cart.png"
$dst = "cart.jfif"
$img = [System.Drawing.Image]::FromFile((Resolve-Path $src))
$img.Save($dst, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$img.Dispose()
```

Higher-quality variant (default ~75; bump to 90 for less visible compression):

```powershell
Add-Type -AssemblyName System.Drawing
$src = "cart.png"; $dst = "cart.jfif"
$img = [System.Drawing.Image]::FromFile((Resolve-Path $src))
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$p = New-Object System.Drawing.Imaging.EncoderParameters(1)
$p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
$img.Save($dst, $codec, $p); $img.Dispose()
```

### ImageMagick

```powershell
magick "cart.png" -quality 90 "cart.jfif"
```

### ffmpeg

```powershell
ffmpeg -i cart.png -q:v 2 cart.jfif
```

### Python (Pillow)

```python
from PIL import Image
Image.open("cart.png").convert("RGB").save("cart.jfif", "JPEG", quality=90)
```

Then append your `SKILL.md` to the new `cart.jfif` using the write snippet above, and tweet it.

### Verify before you trust the round-trip

X may still re-encode based on dimensions, total file size, or your account's upload-quality setting. To be sure:

1. Upload the cartridge to X.
2. Download the served image back (right-click → save image).
3. Run the extract snippet on the downloaded copy.
4. If the payload is gone, the platform re-encoded — try smaller dimensions, lower file size, or enable X's "high-quality images" account setting.

## The bundled skill

`skills/cartridge-read-write/SKILL.md` teaches a Claude Code agent to read, write, and convert cartridges (PNG ↔ JFIF). Install it via the receive snippet above (or copy it manually), then ask Claude things like:

- "embed this skill in cart.png"
- "convert cart.png to JFIF and embed the skill so I can tweet it"
- "what's hidden in this image?"
- "extract the payload from cartridge.jfif and install it as a skill"

### Gotcha for agents

The skill's PowerShell snippets use `$variables`. If you invoke them via `bash -c "powershell -Command \"...$var...\""`, bash eats every `$var` before PowerShell sees it (turning `$i--` into `--` and crashing the parser). Either call PowerShell directly, single-quote the `-Command` argument, or run from a `.ps1` file.

## Notes

- Use UTF-8 if your skill contains non-ASCII characters.
- Do **not** use `Add-Content` / `Set-Content` for the append — they re-encode and corrupt the image. Use `[System.IO.File]::Open(..., "Append")` (PowerShell) or `"ab"` mode (Python).
- For PNG, the IEND+CRC sequence appears exactly once. For JPEG, the 2-byte `FF D9` *can* appear inside scan data, so the readers use `LastIndexOf` / `rfind` to grab the real EOI.
- Larger skills make larger images. Most chat platforms accept multi-MB images without complaint; X is the strictest of the common ones.

## License

MIT
