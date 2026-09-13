"""Local synthetic assembly QA; no Firebase, OpenAI or email access."""
import argparse
import hashlib
import io
import json
import subprocess
import sys
import zipfile
from pathlib import Path
from PIL import Image, ImageDraw
import pypdfium2 as pdfium
from reportlab.pdfgen import canvas

parser = argparse.ArgumentParser()
parser.add_argument("output", type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
items = []
for order, color, fmt in [(1, "#e9f4f3", "JPEG"), (2, "#fff0dd", "PNG")]:
    image = Image.new("RGB", (1000, 1300), color)
    draw = ImageDraw.Draw(image)
    draw.text((100, 130), f"DOCUMENTO SINTETICO QA {order}\nIMAGEM COMPLETA - SEM FATOS REAIS", fill="black", font_size=30)
    draw.rectangle((50, 50, 950, 1250), outline="black", width=4)
    stream = io.BytesIO(); image.save(stream, format=fmt)
    raw = stream.getvalue(); file = f"original-{order}.bin"
    (args.output / file).write_bytes(raw)
    items.append({"file": file, "mimeType": "image/jpeg" if fmt == "JPEG" else "image/png", "order": order, "reference": f"{order:02}", "title": f"Imagem de QA {order}", "sha256": hashlib.sha256(raw).hexdigest()})
stream = io.BytesIO(); pdf = canvas.Canvas(stream)
for number in [1, 2]:
    pdf.setFont("Helvetica", 20); pdf.drawString(70, 740, f"PDF SINTETICO QA — PAGINA {number}")
    pdf.rect(30, 30, 535, 782); pdf.showPage()
pdf.save(); raw = stream.getvalue(); (args.output / "original-3.bin").write_bytes(raw)
items.append({"file": "original-3.bin", "mimeType": "application/pdf", "order": 3, "reference": "03", "title": "PDF de QA com duas páginas", "sha256": hashlib.sha256(raw).hexdigest()})
(args.output / "evidences.json").write_text(json.dumps({"items": list(reversed(items))}), encoding="utf-8")
(args.output / "draft.txt").write_text("# PETIÇÃO INICIAL — QA\nDocumento inteiramente sintético para conferir montagem e paginação.\n# DOS DOCUMENTOS E EVIDÊNCIAS\nO cidadão forneceu três documentos de teste, identificados no índice.\n# DOS PEDIDOS\nTexto sintético; não representa um pedido judicial real.", encoding="utf-8")
script = Path(__file__).resolve().with_name("append_zip_evidence_to_docx.py")
command = [sys.executable, str(script), "--draft-text", str(args.output / "draft.txt"), "--evidence-manifest", str(args.output / "evidences.json"), "--output", str(args.output / "petition.docx"), "--pdf-output", str(args.output / "petition.pdf"), "--case-id", "JF-QA-DOCUMENT", "--version", "3"]
result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", check=True)
metadata = json.loads(result.stdout)
assert metadata["insertedCount"] == 4 and metadata["evidenceCount"] == 3
with zipfile.ZipFile(args.output / "petition.docx") as archive:
    body = archive.read("word/document.xml").decode()
    assert body.count("<wp:docPr") == 4
    assert body.index("Imagem de QA 1") < body.index("Imagem de QA 2") < body.index("PDF de QA")
    assert "Página 1 de 2" in body and "Página 2 de 2" in body
with pdfium.PdfDocument(str(args.output / "petition.pdf")) as document:
    assert len(document) == 5, f"Unexpected page count: {len(document)}"
    for index in range(len(document)):
        page = document[index]; bitmap = page.render(scale=1.3)
        bitmap.to_pil().save(args.output / f"pdf-page-{index + 1:02}.png")
        bitmap.close(); page.close()
# Negative checks: no substituted bytes, path escape, or unsupported format may be ignored.
for changed in [{"sha256": "0" * 64}, {"file": "../original-1.bin"}, {"mimeType": "application/octet-stream"}]:
    payload = {"items": [{**items[0], **changed}]}
    (args.output / "evidences.json").write_text(json.dumps(payload), encoding="utf-8")
    assert subprocess.run(command, capture_output=True).returncode != 0
(args.output / "evidences.json").write_text(json.dumps({"items": items}), encoding="utf-8")
print(json.dumps({"logicalEvidences": 3, "annexPages": 4, "pdfPages": 5, "docxEmbeddedImages": 4, "negativeChecks": 3, "openaiCalls": 0, "emails": 0}))
