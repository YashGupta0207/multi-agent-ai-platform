from flask import Flask, request, jsonify
from flask_cors import CORS
from agents import SummarizerAgent, EmailWriterAgent, TranslatorAgent
import os

app = Flask(__name__)
CORS(app)
@app.route("/")
def home():
    return "AI Agent Hub is running 🚀"

@app.route("/summarize", methods=["POST"])
def summarize():
    data = request.json
    agent = SummarizerAgent()
    result = agent.run(data["text"])
    return jsonify({"result": result})

@app.route("/email", methods=["POST"])
def email():
    data = request.json
    agent = EmailWriterAgent()
    result = agent.run(data["text"])
    return jsonify({"result": result})

@app.route("/translate", methods=["POST"])
def translate():
    data = request.json
    agent = TranslatorAgent()
    result = agent.run(data["text"], data.get("language", "French"))
    return jsonify({"result": result})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)