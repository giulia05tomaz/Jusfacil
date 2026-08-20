const [major, minor, patch] = process.versions.node.split(".").map(Number);

if (major < 22) {
  console.error(`\nJusFácil requer Node.js 22 ou superior. Versão atual: ${process.versions.node}.`);
  console.error("Atualize para Node.js 22 LTS e execute npm install novamente.\n");
  process.exit(1);
}

console.log(`Node.js ${major}.${minor}.${patch} compatível com o JusFácil.`);
