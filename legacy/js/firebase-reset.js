// Importando o Firebase Auth
import { getAuth, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

const auth = getAuth();

async function enviarEmailRedefinicao(email) {
    try {
        await sendPasswordResetEmail(auth, email);
        alert("E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada.");
    } catch (error) {
        console.error("Erro ao enviar o e-mail de redefinição:", error.message, error.code);
        alert(`Erro ao enviar o e-mail: ${error.message}`);
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
