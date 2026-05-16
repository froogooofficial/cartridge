---
name: cartridge-read-write
description: Write text into a PNG file by appending raw bytes after the IEND chunk, and read that text back out. Use when the user asks to embed, append, hide, or extract text in/from a PNG using the "cartridge" trick — the PNG remains a valid image while carrying an arbitrary payload at the tail. Trigger phrases include "cartridge", "append text to png", "hide text in png", "read text from cartridge png", "extract payload from png".
---

# cartridge-read-write

A "cartridge" is a normal PNG file with arbitrary bytes appended after the final `IEND` chunk. PNG decoders stop reading at `IEND`, so the image still renders correctly while the trailing bytes ride along as a payload.

## CRITICAL — how to invoke the snippets below

Every snippet in this skill uses `$variables`. Run them with the **PowerShell tool directly**, OR save them to a `.ps1` and run that file.

**DO NOT** wrap them as `bash -c "powershell -Command \"...$var...\""` — bash interprets every `$var` as an empty bash variable and strips it, turning `$i--` into `--` and producing a parse error in PowerShell.

If you must invoke through bash, use **single quotes** around the `-Command` argument so the `$` characters survive:

```bash
powershell -NoProfile -Command '$bytes = [System.IO.File]::ReadAllBytes("C:\path.png"); ...'
```

…or write the script to a file and run `powershell -NoProfile -File script.ps1`.

## How it works

A PNG file ends with an 8-byte `IEND` chunk: `00 00 00 00 49 45 4E 44 AE 42 60 82`. The 4-byte tail `AE 42 60 82` is the CRC, so every valid PNG ends with the same final 8 bytes: `49 45 4E 44 AE 42 60 82`. Any bytes after that are ignored by image viewers but preserved on disk.

## Writing a payload

```powershell
$src = "C:\path\to\input.png"
$dst = "C:\path\to\output.png"
$payload = "the text to embed"

Copy-Item $src $dst -Force
$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$fs = [System.IO.File]::Open($dst, "Append")
$fs.Write($bytes, 0, $bytes.Length)
$fs.Close()
```

To overwrite the original instead, set `$dst = $src` and skip the `Copy-Item`.

## Reading a payload (preferred — works without knowing the length)

This version uses string `IndexOf` over a Latin-1 view of the bytes, so it's a clean one-liner with no manual byte-by-byte loop:

```powershell
$b = [System.IO.File]::ReadAllBytes("C:\path\to\output.png")
$s = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($b)
$marker = [string]([char]0x49 + [char]0x45 + [char]0x4E + [char]0x44 + [char]0xAE + [char]0x42 + [char]0x60 + [char]0x82)
$idx = $s.LastIndexOf($marker)
if ($idx -ge 0 -and $idx + 8 -lt $b.Length) {
    [System.Text.Encoding]::UTF8.GetString($b, $idx + 8, $b.Length - $idx - 8)
}
```

`LastIndexOf` is used because the literal bytes `49 45 4E 44 AE 42 60 82` only ever appear once in a valid PNG (as the trailing chunk), but using `LastIndexOf` is robust if anything weird shows up.

### Reading when you already know the payload length

```powershell
$bytes = [System.IO.File]::ReadAllBytes("C:\path\to\output.png")
$len = 17  # length of the payload in bytes
[System.Text.Encoding]::UTF8.GetString($bytes, $bytes.Length - $len, $len)
```

## Python alternative (portable, no quoting headaches)

If PowerShell quoting is causing trouble, drop to Python:

```python
data = open(r"C:\path\to\output.png", "rb").read()
idx = data.rfind(b"IEND\xae\x42\x60\x82")
print(data[idx + 8:].decode("utf-8"))
```

Writing in Python:

```python
import shutil
shutil.copyfile(r"C:\path\to\input.png", r"C:\path\to\output.png")
with open(r"C:\path\to\output.png", "ab") as f:
    f.write("the text to embed".encode("utf-8"))
```

## Notes

- The PNG remains visually identical and opens in any viewer.
- Use UTF-8 for non-ASCII text to round-trip safely.
- Avoid `Add-Content` / `Set-Content` for binary appends — they re-encode and can corrupt the file. Use `[System.IO.File]::Open(..., "Append")` or Python's `"ab"` mode instead.
- This is not encryption or steganography — the payload is plainly visible to anyone who looks at the file bytes. Use it for fun/labeling, not secrecy.
