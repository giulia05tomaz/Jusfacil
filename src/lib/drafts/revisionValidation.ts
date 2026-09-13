// Uma alteração de valor só pode ser salva se a peça também refletir o valor
// confirmado; não basta atualizar o JSON e manter o texto da versão antiga.
export function revisedClaimValueMatches(content: string, expected: number): boolean {
  const headings = [...content.matchAll(/VALOR\s+DA\s+CAUSA|D[ÁA]-SE\s+[ÀA]\s+CAUSA\s+O\s+VALOR/gi)];
  return headings.length > 0 && headings.every((heading) => {
    const section = content.slice(heading.index! + heading[0].length, heading.index! + heading[0].length + 450);
    const match = section.match(/R\$\s*([\d.,]+)/i);
    if (!match) return false;
    const raw = match[1].replace(/[.,]+$/, "");
    const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(?:\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
    const actual = Number(normalized);
    return Number.isFinite(actual) && Math.round(actual * 100) === Math.round(expected * 100);
  });
}

export function revisedPartyNamesMatch(content: string, parties: Array<{ name: string | null }>): boolean {
  const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\([^)]*\)/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const documentText = normalize(content);
  return parties.every(party => !party.name || documentText.includes(normalize(party.name)));
}
