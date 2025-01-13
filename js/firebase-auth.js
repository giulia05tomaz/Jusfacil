// Importando as funções necessárias do Firebase
import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { db } from "./firebase-config.js"; // Importa o Firestore inicializado

// Função para autenticar usuário
export async function autenticarUsuario(email, senhaDigitada) {
    try {
        // Consulta no Firestore para buscar o usuário pelo email
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("Usuário não encontrado!");
            return;
        }

        // Verifica a senha armazenada
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const senhaArmazenada = data.senha;

            // Verifica a senha
            if (senhaDigitada === senhaArmazenada) { // Comparação direta para testes
                alert("Login bem-sucedido!");
                // Redireciona para a página "home.html"
                window.location.href = "home.html";
            } else {
                alert("Senha incorreta!");
            }
        });
    } catch (error) {
        console.error("Erro ao autenticar usuário:", error.message);
        alert("Erro ao autenticar usuário. Verifique sua conexão.");
    }
}
