// Importando as funções necessárias do Firebase
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from "./firebase-config.js"; // Importa o Firestore inicializado
import { criptografar, descriptografar } from "./firebase-config.js";

export async function autenticarUsuario(email, senhaDigitada) {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("Usuário não encontrado!");
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const senhaArmazenada = data.senha;

            // Descriptografa a senha salva no banco
            const senhaDescriptografada = descriptografar(senhaArmazenada);

            // Verifica se a senha digitada é igual à senha salva no Firestore
            if (senhaDigitada === senhaDescriptografada) {
                alert("Login bem-sucedido!");
                localStorage.setItem("nomeUsuario", data.nomeCompleto);
                window.location.href = "home.html";
            } else {
                alert("Senha incorreta!");
            }
        });
    } catch (error) {
        console.error("Erro na autenticação:", error.message);
        alert("Erro na autenticação: " + error.message);
    }
}


