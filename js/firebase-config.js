// Importando as funções necessárias do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyAP6wxFvZPN7TsL-qHflz5fgXMr78uD8Wk",
    authDomain: "jusfacil-b979b.firebaseapp.com",
    projectId: "jusfacil-b979b",
    storageBucket: "jusfacil-b979b.firebasestorage.app",
    messagingSenderId: "820230227016",
    appId: "1:820230227016:web:d205f03c3b60f06426c47d",
    measurementId: "G-3Z02HB7QBF"
};

// Inicializando o Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Função para criptografar uma string (senha)
function criptografar(texto) {
    const textoBase64 = btoa(texto); // Codifica o texto em Base64
    return textoBase64.split("").reverse().join(""); // Reverte a string para segurança adicional
}

// Função para salvar dados no Firestore
export async function salvarUsuario(nomeCompleto, email, nomeDeUsuario, senha) {
    try {
        // Criptografa a senha antes de salvar
        const senhaCriptografada = criptografar(senha);

        // Salvar os dados no Firestore
        const docRef = await addDoc(collection(db, "users"), {
            nomeCompleto: nomeCompleto.trim(),
            email: email.trim(),
            nomeDeUsuario: nomeDeUsuario.trim(),
            senha: senhaCriptografada // Salvar a senha criptografada
        });

        console.log("Usuário cadastrado com sucesso! ID:", docRef.id);
        alert("Cadastro realizado com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar os dados:", error.message, error);
        alert("Erro ao salvar os dados: " + error.message);
    }
}
