// Importando o Firebase Auth
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const auth = getAuth();

async function testarEnvioRedefinicao() {
    const email = "seuemail@dominio.com"; // Substitua pelo e-mail a ser testado
    try {
        await sendPasswordResetEmail(auth, email);
        console.log("E-mail de redefinição enviado com sucesso!");
    } catch (error) {
        console.error("Erro ao enviar o e-mail de redefinição:", error.message);
    }
}

testarEnvioRedefinicao();
// Evento de envio no formulário
document.getElementById("formReset").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = document.getElementById("emailReset").value.trim();

    if (!email) {
        alert("Por favor, insira um e-mail válido.");
        return;
    }

    await enviarEmailRedefinicao(email);
});
