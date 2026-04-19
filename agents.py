"""
agents.py — AI Agent Hub (Python / LangChain Backend)
══════════════════════════════════════════════════════
Three built-in agents + a CustomAgent class that mirrors
the browser's localStorage-based custom agent builder.

Run:
    pip install langchain langchain-openai
    python agents.py
"""

import time
import json
import os
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv
load_dotenv()
# ── CONFIG ────────────────────────────────────────────────────
CONFIG = {
    "api_key":     os.getenv("OPENROUTER_API_KEY"),
    "base_url":    "https://openrouter.ai/api/v1",
    "model":       "openai/gpt-4o-mini",
    "max_tokens":  1500,
    "temperature": 0.7,
}

# ── LLM ───────────────────────────────────────────────────────
llm = ChatOpenAI(
    model=CONFIG["model"],
    api_key=CONFIG["api_key"],
    base_url=CONFIG["base_url"],
    max_tokens=CONFIG["max_tokens"],
    temperature=CONFIG["temperature"],
    default_headers={
        "HTTP-Referer": "https://localhost",
        "X-Title": "AI Agent Hub",
    },
)
output_parser = StrOutputParser()


# ═══════════════════════════════════════════════════════════════
# AGENT 1 — TEXT SUMMARIZER
# ═══════════════════════════════════════════════════════════════
class SummarizerAgent:
    """Summarizes text into structured bullet points."""

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=
            "You are a professional text summarizer with expertise in extracting key insights.\n"
            "Your job is to summarize the given text in a concise, clear, and structured way.\n\n"
            "Rules:\n"
            "- Start with a one-sentence TL;DR\n"
            "- Follow with 4-6 bullet points covering the key points\n"
            "- End with a 'Key Takeaway' sentence\n"
            "- Keep language simple and direct\n"
            "- Do not include your own opinions"
        ),
        HumanMessage(content=
            "Please summarize the following text:\n\n{text}"
        ),
    ])

    def __init__(self):
        self.chain = self.prompt | llm | output_parser

    def run(self, text: str) -> str:
        print("[SummarizerAgent] Running...")
        start = time.time()
        result = self.chain.invoke({"text": text})
        print(f"[SummarizerAgent] Done in {time.time()-start:.2f}s")
        return result


# ═══════════════════════════════════════════════════════════════
# AGENT 2 — EMAIL WRITER
# ═══════════════════════════════════════════════════════════════
class EmailWriterAgent:
    """Writes professional emails from rough notes."""

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=
            "You are an expert professional email writer.\n"
            "Write a polished, well-structured email based on the user's notes or topic.\n\n"
            "Always follow this format:\n"
            "Subject: [clear subject line]\n\n"
            "[Greeting],\n\n"
            "[Opening sentence - state the purpose]\n\n"
            "[Body paragraphs - 2-3 short paragraphs]\n\n"
            "[Clear call-to-action or closing statement]\n\n"
            "[Sign-off],\n"
            "[Your Name]\n\n"
            "Keep the tone professional yet warm. Be concise."
        ),
        HumanMessage(content=
            "Write a professional email based on these notes:\n\n{text}"
        ),
    ])

    def __init__(self):
        self.chain = self.prompt | llm | output_parser

    def run(self, text: str) -> str:
        print("[EmailWriterAgent] Running...")
        start = time.time()
        result = self.chain.invoke({"text": text})
        print(f"[EmailWriterAgent] Done in {time.time()-start:.2f}s")
        return result


# ═══════════════════════════════════════════════════════════════
# AGENT 3 — LANGUAGE TRANSLATOR
# ═══════════════════════════════════════════════════════════════
class TranslatorAgent:
    """Translates text into any target language."""

    prompt = ChatPromptTemplate.from_messages([
        SystemMessage(content=
            "You are an expert language translator with native-level fluency in all major languages.\n"
            "Translate the given text accurately into {target_language}.\n\n"
            "Rules:\n"
            "- Preserve the original meaning, tone, and style\n"
            "- Do not add explanations or commentary\n"
            "- If the text contains technical terms, translate them appropriately\n"
            "- Output ONLY the translated text, nothing else"
        ),
        HumanMessage(content=   
            "Translate the following text into {target_language}:\n\n{text}"
        ),
    ])

    def __init__(self):
        self.chain = self.prompt | llm | output_parser

    def run(self, text: str, target_language: str = "French") -> str:
        print(f"[TranslatorAgent] Translating to {target_language}...")
        start = time.time()
        result = self.chain.invoke({"text": text, "target_language": target_language})
        print(f"[TranslatorAgent] Done in {time.time()-start:.2f}s")
        return result


# ═══════════════════════════════════════════════════════════════
# AGENT 4 — CUSTOM AGENT
# ═══════════════════════════════════════════════════════════════
class CustomAgent:
    """
    Dynamically creates an agent from a user-defined system prompt.
    Mirrors the browser's custom agent builder.

    Usage:
        agent = CustomAgent(
            name="Code Reviewer",
            system_prompt="You are an expert code reviewer. Analyze code for bugs..."
        )
        result = agent.run("def add(a, b): return a - b")
    """

    def __init__(self, name: str, system_prompt: str):
        """
        Args:
            name:          Display name for the agent (used in logs).
            system_prompt: The full system prompt that defines the agent's behavior.
        """
        self.name = name
        self.system_prompt = system_prompt

        # Build a dynamic ChatPromptTemplate from the user-provided system prompt
        self.prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="{system_prompt}"),
            HumanMessage(content="{text}"),
        ])
        self.chain = self.prompt | llm | output_parser

    def run(self, text: str) -> str:
        """
        Run the custom agent on the given input text.
        Args:
            text: The user's input to process.
        Returns:
            The agent's response as a string.
        """
        print(f"[CustomAgent:{self.name}] Running...")
        start = time.time()
        result = self.chain.invoke({
            "system_prompt": self.system_prompt,
            "text": text,
        })
        print(f"[CustomAgent:{self.name}] Done in {time.time()-start:.2f}s")
        return result


# ═══════════════════════════════════════════════════════════════
# CUSTOM AGENT REGISTRY
# Mirrors the browser's localStorage store — load/save to JSON
# ═══════════════════════════════════════════════════════════════
AGENTS_FILE = "custom_agents.json"

def load_custom_agents() -> list:
    """Load saved custom agents from a local JSON file."""
    if not os.path.exists(AGENTS_FILE):
        return []
    with open(AGENTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def save_custom_agents(agents: list):
    """Persist custom agents to a local JSON file."""
    with open(AGENTS_FILE, "w", encoding="utf-8") as f:
        json.dump(agents, f, indent=2, ensure_ascii=False)
    print(f"[Registry] Saved {len(agents)} agent(s) to {AGENTS_FILE}")

def add_custom_agent(name: str, system_prompt: str, icon: str = "✦", description: str = "") -> dict:
    """
    Register a new custom agent and persist it.
    Returns the agent record dict.
    """
    agents = load_custom_agents()
    record = {
        "id":           f"custom_{int(time.time()*1000)}",
        "name":         name,
        "icon":         icon,
        "description":  description or f"Custom agent: {name}",
        "systemPrompt": system_prompt,
        "createdAt":    datetime.now().isoformat(),
    }
    agents.append(record)
    save_custom_agents(agents)
    print(f"[Registry] Added agent: '{name}' (id={record['id']})")
    return record

def get_custom_agent(name_or_id: str) -> "CustomAgent | None":
    """
    Retrieve a saved custom agent by name or id.
    Returns a ready-to-use CustomAgent instance, or None if not found.
    """
    agents = load_custom_agents()
    record = next(
        (a for a in agents if a["id"] == name_or_id or a["name"].lower() == name_or_id.lower()),
        None
    )
    if not record:
        print(f"[Registry] Agent not found: '{name_or_id}'")
        return None
    return CustomAgent(name=record["name"], system_prompt=record["systemPrompt"])


# ═══════════════════════════════════════════════════════════════
# CLI DEMO
# ═══════════════════════════════════════════════════════════════
def run_demo():
    SEP = "=" * 60

    # ── Built-in: Summarizer ────────────────────────────────
    summarizer = SummarizerAgent()
    sample_text = (
        "Artificial intelligence is transforming industries worldwide. "
        "From healthcare to finance, AI-powered tools are automating repetitive tasks, "
        "improving decision-making accuracy, and unlocking insights from massive datasets. "
        "However, adoption comes with challenges including data privacy, algorithmic bias, "
        "and workforce displacement. Experts agree that responsible AI development requires "
        "transparent governance frameworks and inclusive stakeholder engagement. "
        "Despite the challenges, the global AI market is projected to exceed $1.8 trillion by 2030."
    )
    print(f"\n{SEP}\nAGENT 1 — SUMMARIZER\n{SEP}")
    print(summarizer.run(sample_text))

    # ── Built-in: Email Writer ───────────────────────────────
    email_writer = EmailWriterAgent()
    print(f"\n{SEP}\nAGENT 2 — EMAIL WRITER\n{SEP}")
    print(email_writer.run("Ask the client to schedule a follow-up call next week to review the project proposal."))

    # ── Built-in: Translator ─────────────────────────────────
    translator = TranslatorAgent()
    print(f"\n{SEP}\nAGENT 3 — TRANSLATOR (to Japanese)\n{SEP}")
    print(translator.run("Good morning! I hope you have a wonderful and productive day ahead.", target_language="Japanese"))

    # ── Custom: Code Reviewer (created on the fly) ───────────
    code_reviewer = CustomAgent(
        name="Code Reviewer",
        system_prompt=(
            "You are an expert code reviewer with 10+ years of experience.\n"
            "Analyze the given code and provide:\n"
            "1. A brief summary of what the code does\n"
            "2. Any bugs or logical errors found\n"
            "3. Suggestions for improvement\n"
            "4. Best practices to follow\n\n"
            "Be concise, specific, and constructive."
        )
    )
    print(f"\n{SEP}\nAGENT 4 — CUSTOM: CODE REVIEWER\n{SEP}")
    print(code_reviewer.run(
        "def calculate_average(numbers):\n"
        "    total = 0\n"
        "    for n in numbers:\n"
        "        total += n\n"
        "    return total / len(numbers)"
    ))

    # ── Custom: Register & load from file ────────────────────
    print(f"\n{SEP}\nAGENT 5 — CUSTOM: SAVED + LOADED FROM FILE\n{SEP}")
    add_custom_agent(
        name="Blog Writer",
        icon="✍️",
        description="Writes engaging blog posts",
        system_prompt=(
            "You are a professional blog writer specializing in technology topics.\n"
            "Write an engaging, well-structured blog post introduction based on the given topic.\n"
            "Use a catchy hook, explain why it matters, and end with a teaser for the rest.\n"
            "Keep it under 150 words."
        )
    )
    blog_writer = get_custom_agent("Blog Writer")
    if blog_writer:
        print(blog_writer.run("The rise of AI agents in everyday software development"))

    print(f"\n{SEP}\nAll agents completed successfully.\n{SEP}\n")


    if __name__ == "__main__":
        while True:
            run_demo()
            time.sleep(60)