const chatMessages = document.getElementById("chatMessages");
const userInput = document.getElementById("userInput");
const sendMessage = document.getElementById("sendMessage");

// Atualize a chave da API aqui
const apiKey = "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";

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

// Função para enviar mensagens para a API da OpenAI
async function sendToGPT(message) {
    const endpoint = "https://api.openai.com/v1/chat/completions";

    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
    };

    // Configura o conteúdo da mensagem baseado no estado da conversa
    let systemMessage = "";

    if (conversationState === "introducao") {
        systemMessage = "Você é o JurisBot, um assistente jurídico digital. Quando o cliente disser 'Oi', peça para descrever os fatos detalhadamente.";
    } else if (conversationState === "descricao_fatos") {
        systemMessage = "Você é o JurisBot, um assistente jurídico digital. Após o cliente descrever os fatos, peça evidências relacionadas ao caso.";
    } else if (conversationState === "coleta_evidencias") {
        systemMessage = "Você é o JurisBot, um assistente jurídico digital. Agradeça ao cliente pelas evidências enviadas e informe que a área competente dará continuidade ao processo.";
    }

    const body = JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: systemMessage },
            { role: "user", content: message },
        ],
    });

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: headers,
            body: body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Erro na API: ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content; // Extrai a resposta do bot
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
