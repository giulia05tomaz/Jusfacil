const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendMessage = document.getElementById("sendMessage");

// Variável para gerenciar o estado da conversa
let conversationState = "introducao";

// Função para adicionar mensagens ao chat
function appendMessage(sender, message) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("message", sender);
    messageDiv.textContent = message;
    chatMessages.appendChild(messageDiv);

    // Rolagem automática para a última mensagem
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Função para enviar mensagens para o servidor
async function sendToGPT(message) {
    try {
        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: message,
                conversationState: conversationState,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API: ${errorText}`);
        }

        const data = await response.json();
        return data.reply || "Desculpe, ocorreu um erro ao obter resposta.";
    } catch (error) {
        console.error("Erro ao se comunicar com a API:", error);
        return "Desculpe, ocorreu um erro ao conectar ao servidor.";
    }
}

// Lida com o envio de mensagens
sendMessage.addEventListener("click", async () => {
    const userMessage = userInput.value.trim();
    if (!userMessage) return;

    // Adiciona a mensagem do usuário ao chat
    appendMessage("user", userMessage);
    userInput.value = "";

    // Adiciona uma mensagem de "carregando"
    const loadingMessage = document.createElement("div");
    loadingMessage.classList.add("message", "bot");
    loadingMessage.textContent = "Digitando...";
    chatMessages.appendChild(loadingMessage);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    try {
        // Envia a mensagem para a API e obtém a resposta
        const botReply = await sendToGPT(userMessage);

        // Remove a mensagem de "carregando"
        loadingMessage.remove();

        // Adiciona a resposta do bot ao chat
        appendMessage("bot", botReply);

        // Atualiza o estado da conversa
        if (conversationState === "introducao" && userMessage.toLowerCase() === "oi") {
            conversationState = "descricao_fatos";
        } else if (conversationState === "descricao_fatos") {
            conversationState = "coleta_evidencias";
        }
    } catch (error) {
        // Remove a mensagem de "carregando" em caso de erro
        loadingMessage.remove();

        // Mostra uma mensagem de erro no chat
        appendMessage("bot", "Desculpe, não foi possível obter uma resposta no momento.");
    }
});
