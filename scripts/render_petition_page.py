"""Render one page of the verified private petition PDF; no OCR or AI."""
import argparse
import json
from pathlib import Path
import pypdfium2 as pdfium

parser = argparse.ArgumentParser()
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--page", type=int, required=True)
args = parser.parse_args()
with pdfium.PdfDocument(str(args.input)) as pdf:
    count = len(pdf)
    if not 1 <= args.page <= count or count > 600:
        raise ValueError("PAGE_INVALID")
    first_annex = None
    for index in range(count):
        page = pdf[index]
        text_page = page.get_textpage()
        text = text_page.get_text_range().upper()
        text_page.close(); page.close()
        if "ANEXO PROBATÓRIO" in text or "ANEXOS DE QA" in text or "ANEXO PROBATORIO" in text:
            first_annex = index + 1
            break
    page = pdf[args.page - 1]
    width, height = page.get_size()
    if width <= 0 or height <= 0:
        raise ValueError("PAGE_INVALID")
    bitmap = page.render(scale=min(2, 1400 / max(width, height)))
    bitmap.to_pil().convert("RGB").save(args.output, format="PNG")
    bitmap.close(); page.close()
print(json.dumps({"pages": count, "page": args.page, "firstAnnexPage": first_annex}))
