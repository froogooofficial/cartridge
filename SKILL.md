---
name: cartridge-read-write
description: Write text into a PNG or JPEG/JFIF image by appending raw bytes after the image's end marker, and read that text back out. Use when the user asks to embed, append, hide, or extract text in/from an image using the "cartridge" trick — the image remains valid and renders normally while carrying a text payload at the tail. Also covers converting PNG to JFIF so cartridges can be shared on platforms (like X/Twitter) that prefer JPEG. Trigger phrases include "cartridge", "append text to png/jpeg/jfif", "hide text in image", "read text from cartridge", "extract payload from image", "convert png to jfif".
---

# cartridge-read-write

A "cartridge" is a normal image file with arbitrary bytes appended after its end-of-image marker. Image decoders stop at the marker, so the picture still renders, while the trailing bytes ride along as a payload.

Supports two formats:

| Format | Magic (first bytes) | End marker | Bytes to skip after marker |
| --- | --- | --- | --- |
| PNG | `89 50 4E 47` | `49 45 4E 44 AE 42 60 82` (`IEND` + CRC) — 8 bytes | 8 |
| JPEG / JFIF | `FF D8 FF` | `FF D9` (EOI) — 2 bytes | 2 |

`.jpg`, `.jpeg`, and `.jfif` are all the same JPEG byte format — only the extension differs.

## CRITICAL — how to invoke the snippets below

Every snippet uses `$variables`. Run with the **PowerShell tool directly**, OR save to a `.ps1` and run that file.

**DO NOT** wrap as `bash -c "powershell -Command \"...$var...\""` — bash interprets every `$var` as an empty bash variable and strips it, turning `$i--` into `--` and producing a parse error in PowerShell. If you must invoke through bash, use single quotes around `-Command` so `$` survives:

```bash
powershell -NoProfile -Command '$b = [System.IO.File]::ReadAllBytes("C:\path.png"); ...'
```

…or run from a file: `powershell -NoProfile -File script.ps1`.

## Writing a payload (works for PNG or JPEG/JFIF — appending is format-agnostic)

```powershell
$src     = "C:\path\to\input.png"        # or .jpg / .jpeg / .jfif
$dst     = "C:\path\to\output.png"       # match the source extension
$payload = "the text to embed"

Copy-Item $src $dst -Force
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$fs = [System.IO.File]::Open((Resolve-Path $dst), "Append")
$fs.Write($bytes, 0, $bytes.Length)
$fs.Close()
```

To overwrite in place, set `$dst = $src` and skip the `Copy-Item`.

## Reading a payload (auto-detect PNG vs JPEG)

This locates the correct end marker by sniffing the first bytes of the file:

```powershell
$path = "C:\path\to\output.png"   # or .jpg / .jpeg / .jfif
$b = [System.IO.File]::ReadAllBytes((Resolve-Path $path))
$s = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($b)

if ($b[0] -eq 0x89 -and $b[1] -eq 0x50) {
    # PNG: IEND + CRC, 8-byte marker, skip 8
    $marker = [string]([char]0x49 + [char]0x45 + [char]0x4E + [char]0x44 + [char]0xAE + [char]0x42 + [char]0x60 + [char]0x82)
    $skip = 8
} elseif ($b[0] -eq 0xFF -and $b[1] -eq 0xD8) {
    # JPEG/JFIF: EOI, 2-byte marker, skip 2
    $marker = [string]([char]0xFF + [char]0xD9)
    $skip = 2
} else {
    throw "Unsupported image format (not PNG or JPEG)"
}

$idx = $s.LastIndexOf($marker)
if ($idx -ge 0 -and $idx + $skip -lt $b.Length) {
    [System.Text.Encoding]::UTF8.GetString($b, $idx + $skip, $b.Length - $idx - $skip)
}
```

`LastIndexOf` matters more for JPEG than PNG — the 2-byte sequence `FF D9` can appear inside JPEG entropy-coded scan data, but the *real* EOI is always the final occurrence. (For PNG, `IEND` + CRC only ever appears once, but `LastIndexOf` is harmless and keeps the code uniform.)

### Reading when you already know the payload length (format-agnostic)

```powershell
$b = [System.IO.File]::ReadAllBytes("C:\path\to\output.png")
$len = 4139  # known payload length in bytes
[System.Text.Encoding]::UTF8.GetString($b, $b.Length - $len, $len)
```

## Converting PNG → JFIF (so cartridges can be posted on X/Twitter)

X/Twitter accepts PNG uploads but typically re-encodes them, which would destroy the cartridge. JPEG uploads (`.jpg` / `.jpeg` / `.jfif`) are more often passed through when they're already within the platform's size/quality budget. Convert your PNG to JFIF first, then embed the payload.

### Native PowerShell (no external dependencies)

```powershell
Add-Type -AssemblyName System.Drawing
$src = "C:\path\to\input.png"
$dst = "C:\path\to\output.jfif"
$img = [System.Drawing.Image]::FromFile((Resolve-Path $src))
$img.Save($dst, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$img.Dispose()
```

For a specific JPEG quality (default ~75 is fine; bump to 90+ if you care about visible loss):

```powershell
Add-Type -AssemblyName System.Drawing
$src = "C:\path\to\input.png"
$dst = "C:\path\to\output.jfif"
$img = [System.Drawing.Image]::FromFile((Resolve-Path $src))
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, [long]90)
$img.Save($dst, $codec, $params)
$img.Dispose()
```

### ImageMagick (if installed)

```powershell
magick "input.png" -quality 90 "output.jfif"
```

### ffmpeg (if installed)

```powershell
ffmpeg -i input.png -q:v 2 output.jfif
```

### After conversion

Append your payload to the new `.jfif` using the write snippet above. The recipient extracts it with the auto-detect reader.

### Honest caveat about X/Twitter

Platforms re-encode images at their discretion based on dimensions, file size, and account/upload settings. Cartridges only survive when the image bytes are stored unchanged on the platform's CDN. Test by uploading, downloading the served file, and running the reader on it. If the payload is gone, the platform re-encoded — try smaller dimensions, lower file size, or X's "high-quality images" account setting.

## Python alternative (portable, no quoting headaches)

### Read (auto-detect)

```python
def read_cartridge(path):
    data = open(path, "rb").read()
    if data[:2] == b"\x89P":           # PNG
        marker, skip = b"IEND\xae\x42\x60\x82", 8
    elif data[:2] == b"\xff\xd8":      # JPEG / JFIF
        marker, skip = b"\xff\xd9", 2
    else:
        raise ValueError("Not a PNG or JPEG file")
    idx = data.rfind(marker)
    if idx < 0:
        raise ValueError("End marker not found")
    return data[idx + skip:].decode("utf-8")

print(read_cartridge("output.jfif"))
```

### Write

```python
import shutil
shutil.copyfile("input.jfif", "output.jfif")
with open("output.jfif", "ab") as f:
    f.write("the text to embed".encode("utf-8"))
```

### Convert PNG → JFIF

```python
from PIL import Image
Image.open("input.png").convert("RGB").save("output.jfif", "JPEG", quality=90)
```

## Notes

- The image remains visually identical (or visually equivalent after JPEG conversion) and opens in any viewer.
- Use UTF-8 for non-ASCII text to round-trip safely.
- Avoid `Add-Content` / `Set-Content` for binary appends — they re-encode and corrupt the file. Use `[System.IO.File]::Open(..., "Append")` or Python `"ab"` mode.
- This is not encryption or steganography — the payload is plainly visible to anyone who looks at the file bytes. Use for fun/labeling/skill-sharing, not secrecy.
