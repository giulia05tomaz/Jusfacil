from flask import Flask, request, jsonify
import openai

app = Flask(__name__)

# Configuração da API da OpenAI
openai.api_key = "SUA_API_KEY_AQUI"

# Prompt do sistema para controlar as respostas
SYSTEM_PROMPT = """
Você é o JurisBot, um assistente jurídico digital para uma empresa chamada JusFácil. 
Responda de maneira clara, profissional e educada. Evite responder sobre assuntos fora do contexto jurídico.
"""

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message", "")

    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_message}
            ]
        )
        reply = response["choices"][0]["message"]["content"]
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"reply": "Desculpe, algo deu errado. Tente novamente mais tarde."})

if __name__ == "__main__":
    app.run(debug=True)
