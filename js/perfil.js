import { auth, db } from "./firebase-config.js"; 
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", () => {
    console.log("Verificando autenticação...");

    // Tenta recuperar o nome salvo no localStorage
    const nomeArmazenado = localStorage.getItem("nomeUsuario");

    if (nomeArmazenado) {
        document.getElementById("username").textContent = nomeArmazenado;
    } else {
        document.getElementById("username").textContent = "Usuário não identificado";
    }

    // Se houver autenticação Firebase, sobrescreve com os dados corretos
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Usuário autenticado:", user.uid);

            try {
                const userRef = doc(db, "users", user.uid);
                const userSnap = await getDoc(userRef);

                if (userSnap.exists()) {
                    const userData = userSnap.data();
                    console.log("Dados do usuário:", userData);
                    document.getElementById("username").textContent = userData.nomeCompleto || nomeArmazenado || "Usuário";
                }
            } catch (error) {
                console.error("Erro ao buscar dados do usuário:", error);
            }
        }
    });
});
