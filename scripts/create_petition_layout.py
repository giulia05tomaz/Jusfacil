"""Retain a reference DOCX's layout/styles, but none of its petition or evidence data."""
import argparse
import io
import zipfile
from copy import deepcopy
from pathlib import Path
from lxml import etree
from docx import Document
from docx.oxml.ns import qn

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
with zipfile.ZipFile(args.source) as source:
    tree = etree.fromstring(source.read("word/document.xml"))
    section = tree.find(".//" + qn("w:sectPr"))
    if section is None:
        raise ValueError("REFERENCE_SECTION_MISSING")
    document = Document()
    body = document._element.body
    for child in list(body):
        body.remove(child)
    clean_section = deepcopy(section)
    for child in list(clean_section):
        if child.tag in {qn("w:headerReference"), qn("w:footerReference")}:
            clean_section.remove(child)
    body.append(clean_section)
    document.core_properties.author = "JusFácil"
    document.core_properties.last_modified_by = "JusFácil"
    document.core_properties.title = "Modelo de layout de petição"
    stream = io.BytesIO()
    document.save(stream)
    # Only presentation parts are copied; no customXml, media, thumbnail, body or source metadata.
    retained = {"word/styles.xml", "word/fontTable.xml", "word/theme/theme1.xml", "word/numbering.xml"}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(stream) as base, zipfile.ZipFile(args.output, "w", zipfile.ZIP_DEFLATED) as result:
        for entry in base.infolist():
            data = source.read(entry.filename) if entry.filename in retained and entry.filename in source.namelist() else base.read(entry.filename)
            result.writestr(entry, data)
print("Layout retained; petition text, source metadata and evidence images excluded.")
