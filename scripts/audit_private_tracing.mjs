import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

async function collect(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collect(name));
    else if (entry.name.endsWith('.nft.json')) result.push(name);
  }
  return result;
}

const traces = await collect('.next/server');
let privateEntries = 0;
let requiredArtifactAssets = false;
for (const trace of traces) {
  const files = JSON.parse(await readFile(trace, 'utf8')).files;
  const normalized = files.map(file => file.replaceAll('\\', '/'));
  privateEntries += normalized.filter(file => /(?:^|\/)(?:\.env[^/]*|\.artifacts|\.evidence-originals|serviceAccount[^/]*\.json|service-account[^/]*\.json|firebase-admin[^/]*\.json|credentials[^/]*\.json|[^/]*\.pem)(?:\/|$)/i.test(file)).length;
  if (trace.replaceAll('\\', '/').includes('/drafts/[version]/artifact/')) {
    requiredArtifactAssets = ['append_zip_evidence_to_docx.py', 'render_petition_page.py', 'petition-layout.docx'].every(asset => normalized.some(file => file.endsWith('/' + asset)));
  }
}
console.log(JSON.stringify({ traces: traces.length, privateEntries, requiredArtifactAssets }));
if (!traces.length || privateEntries || !requiredArtifactAssets) process.exitCode = 1;
