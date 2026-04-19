/**
 * AI Agent Hub — script.js
 * ─────────────────────────────────────────────────────────────
 * LangChain-style prompt templates + Backend API integration
 * Three built-in agents + unlimited custom agents (localStorage)
 * API key is stored server-side only (Vercel env var)
 * ─────────────────────────────────────────────────────────────
 */

// ── CONFIG ────────────────────────────────────────────────────
const CONFIG = {
  MODEL: "openai/gpt-4o-mini",   // informational only, actual model set on backend
};

const BACKEND_URL = "https://multi-agent-ai-platform-msov.vercel.app";

async function callBackend(endpoint, payload) {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let errMsg = `Backend error ${response.status}`;
    try {
      const errData = await response.json();
      errMsg = errData?.error || errMsg;
    } catch (_) { }
    throw new Error(errMsg);
  }

  return await response.json();
}

// ── BUILT-IN PROMPT TEMPLATES (LangChain-style) ───────────────
const BUILTIN_TEMPLATES = {
  summarizer: {
    name: "Text Summarizer",
    icon: "⟳",
    spinner: "Summarizing...",
  },

  email: {
    name: "Email Writer",
    icon: "✉",
    spinner: "Drafting email...",
  },

  translator: {
    name: "Translator",
    icon: "⇄",
    spinner: "Translating...",
  },
};

// ── CUSTOM AGENTS (localStorage) ─────────────────────────────
/**
 * Custom agents are stored as an array in localStorage.
 * Shape: [{ id, name, icon, description, systemPrompt, createdAt }]
 */
const STORAGE_KEY = "ai_hub_custom_agents";

function loadCustomAgents() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function saveCustomAgents(agents) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
}

let customAgents = loadCustomAgents();

// ── UTILITY ───────────────────────────────────────────────────
function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── UI STATE ──────────────────────────────────────────────────
const UI = {
  userInput: document.getElementById("userInput"),
  charCount: document.getElementById("charCount"),
  runBtn: document.getElementById("runBtn"),
  clearBtn: document.getElementById("clearBtn"),
  copyBtn: document.getElementById("copyBtn"),
  retryBtn: document.getElementById("retryBtn"),
  targetLang: document.getElementById("targetLang"),
  translatorOptions: document.getElementById("translatorOptions"),
  activeBadgeLabel: document.getElementById("activeBadgeLabel"),
  spinnerLabel: document.getElementById("spinnerLabel"),
  errorMsg: document.getElementById("errorMsg"),
  resultText: document.getElementById("resultText"),
  metaModel: document.getElementById("metaModel"),
  metaTime: document.getElementById("metaTime"),
  outputIdle: document.getElementById("outputIdle"),
  outputLoading: document.getElementById("outputLoading"),
  outputError: document.getElementById("outputError"),
  outputResult: document.getElementById("outputResult"),
  agentTabs: document.querySelectorAll(".agent-tab"),
  customAgentTabs: document.getElementById("customAgentTabs"),
  customEmpty: document.getElementById("customEmpty"),
  // Modal
  modalOverlay: document.getElementById("modalOverlay"),
  modalTitle: document.getElementById("modalTitle"),
  modalSaveLabel: document.getElementById("modalSaveLabel"),
  customAgentName: document.getElementById("customAgentName"),
  customAgentIcon: document.getElementById("customAgentIcon"),
  customAgentDesc: document.getElementById("customAgentDesc"),
  customAgentPrompt: document.getElementById("customAgentPrompt"),

  currentAgent: "summarizer",
  editingId: null,       // non-null when editing an existing custom agent
  lastResult: "",

  showOutput(state) {
    this.outputIdle.style.display = state === "idle" ? "" : "none";
    this.outputLoading.style.display = state === "loading" ? "flex" : "none";
    this.outputError.style.display = state === "error" ? "flex" : "none";
    this.outputResult.style.display = state === "result" ? "flex" : "none";
    this.copyBtn.style.display = state === "result" ? "" : "none";
  },
};

// ── ACTIVE TAB HIGHLIGHT ──────────────────────────────────────
function highlightTab(activeKey) {
  // Built-in tabs
  UI.agentTabs.forEach(tab => {
    tab.classList.toggle("active", tab.dataset.agent === activeKey);
    tab.setAttribute("aria-selected", tab.dataset.agent === activeKey);
  });
  // Custom tabs
  document.querySelectorAll(".custom-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.agent === activeKey);
  });
}

// ── SWITCH AGENT ──────────────────────────────────────────────
function switchAgent(agentKey) {
  UI.currentAgent = agentKey;
  highlightTab(agentKey);

  // Badge label
  if (BUILTIN_TEMPLATES[agentKey]) {
    UI.activeBadgeLabel.textContent = BUILTIN_TEMPLATES[agentKey].name;
    UI.spinnerLabel.textContent = BUILTIN_TEMPLATES[agentKey].spinner;
  } else {
    const agent = customAgents.find(a => a.id === agentKey);
    UI.activeBadgeLabel.textContent = agent ? agent.name : "Custom Agent";
    UI.spinnerLabel.textContent = "Processing...";
  }

  // Show/hide translator options
  UI.translatorOptions.style.display = agentKey === "translator" ? "flex" : "none";

  // Placeholder
  const placeholders = {
    summarizer: "Paste the text you want to summarize...",
    email: "Describe what the email should be about. E.g. 'Request a meeting with the marketing team for next Tuesday'",
    translator: "Paste the text you want to translate...",
  };
  UI.userInput.placeholder = placeholders[agentKey] || "Enter your input for this agent...";

  UI.showOutput("idle");
}

// ── RUN AGENT ─────────────────────────────────────────────────
async function runAgent() {
  const text = UI.userInput.value.trim();
  const agent = UI.currentAgent;

  if (!text) { showError("Please enter some text to process."); return; }

  UI.spinnerLabel.textContent = BUILTIN_TEMPLATES[agent]?.spinner || "Processing...";
  UI.showOutput("loading");
  UI.runBtn.disabled = true;

  try {
    const start = Date.now();
    let resultText = "";
    let modelName = CONFIG.MODEL;

    if (agent === "summarizer") {
      const data = await callBackend("/summarize", { text });
      resultText = data.result;
      if (data.model) modelName = data.model;

    } else if (agent === "email") {
      const data = await callBackend("/email", { text });
      resultText = data.result;
      if (data.model) modelName = data.model;

    } else if (agent === "translator") {
      const language = UI.targetLang.value;
      const data = await callBackend("/translate", { text, language });
      resultText = data.result;
      if (data.model) modelName = data.model;

    } else {
      // Custom agent — proxied through backend, no API key in frontend
      const agentObj = customAgents.find(a => a.id === agent);
      if (!agentObj) throw new Error("Agent not found.");

      const data = await callBackend("/custom-agent", {
        systemPrompt: agentObj.systemPrompt,
        userText: text,
      });
      resultText = data.result;
      if (data.model) modelName = data.model;
    }

    const ms = Date.now() - start;

    UI.lastResult = resultText;
    UI.resultText.textContent = resultText;
    UI.metaModel.textContent = `Model: ${modelName}`;
    UI.metaTime.textContent = `${(ms / 1000).toFixed(2)}s`;
    UI.showOutput("result");

  } catch (err) {
    console.error("[Agent Error]", err);
    showError(err.message || "Something went wrong. Please try again.");
  } finally {
    UI.runBtn.disabled = false;
  }
}

function showError(msg) {
  UI.errorMsg.textContent = msg;
  UI.showOutput("error");
}

// ── COPY OUTPUT ───────────────────────────────────────────────
async function copyOutput() {
  if (!UI.lastResult) return;
  try {
    await navigator.clipboard.writeText(UI.lastResult);
    UI.copyBtn.textContent = "Copied!";
    setTimeout(() => (UI.copyBtn.textContent = "Copy"), 2000);
  } catch (_) {
    const ta = document.createElement("textarea");
    ta.value = UI.lastResult;
    ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    UI.copyBtn.textContent = "Copied!";
    setTimeout(() => (UI.copyBtn.textContent = "Copy"), 2000);
  }
}

// ════════════════════════════════════════════════════════════
// CUSTOM AGENT CRUD
// ════════════════════════════════════════════════════════════

// ── RENDER CUSTOM AGENT TABS ──────────────────────────────────
function renderCustomAgents() {
  const container = UI.customAgentTabs;
  const empty = UI.customEmpty;
  container.innerHTML = "";

  if (!customAgents.length) {
    empty.style.display = "flex";
    container.style.display = "none";
    return;
  }

  empty.style.display = "none";
  container.style.display = "grid";

  customAgents.forEach(agent => {
    const tab = document.createElement("div");
    tab.className = "agent-tab custom-tab";
    tab.dataset.agent = agent.id;
    if (UI.currentAgent === agent.id) tab.classList.add("active");

    tab.innerHTML = `
      <div class="custom-tab-main" data-agent="${agent.id}">
        <span class="tab-icon">${agent.icon || "✦"}</span>
        <div>
          <span class="tab-name">${escHtml(agent.name)}</span>
          <span class="tab-desc">${escHtml(agent.description)}</span>
        </div>
      </div>
      <div class="custom-tab-actions">
        <button class="tab-action-btn edit-btn"   data-id="${agent.id}" title="Edit agent">&#9998;</button>
        <button class="tab-action-btn delete-btn" data-id="${agent.id}" title="Delete agent">&#10005;</button>
      </div>`;

    // Click on main area → select agent
    tab.querySelector(".custom-tab-main").addEventListener("click", () => switchAgent(agent.id));

    // Edit
    tab.querySelector(".edit-btn").addEventListener("click", e => {
      e.stopPropagation();
      openModal(agent.id);
    });

    // Delete
    tab.querySelector(".delete-btn").addEventListener("click", e => {
      e.stopPropagation();
      deleteCustomAgent(agent.id);
    });

    container.appendChild(tab);
  });
}

// ── OPEN MODAL ────────────────────────────────────────────────
function openModal(editId = null) {
  UI.editingId = editId;

  if (editId) {
    // Edit mode — pre-fill form
    const agent = customAgents.find(a => a.id === editId);
    if (!agent) return;
    UI.modalTitle.textContent = "Edit Agent";
    UI.modalSaveLabel.textContent = "Update Agent";
    UI.customAgentName.value = agent.name;
    UI.customAgentIcon.value = agent.icon || "";
    UI.customAgentDesc.value = agent.description;
    UI.customAgentPrompt.value = agent.systemPrompt;
  } else {
    // Create mode — clear form
    UI.modalTitle.textContent = "Create Custom Agent";
    UI.modalSaveLabel.textContent = "Save Agent";
    UI.customAgentName.value = "";
    UI.customAgentIcon.value = "";
    UI.customAgentDesc.value = "";
    UI.customAgentPrompt.value = "";
  }

  UI.modalOverlay.classList.add("open");
  setTimeout(() => UI.customAgentName.focus(), 100);
}

function closeModal() {
  UI.modalOverlay.classList.remove("open");
  UI.editingId = null;
}

// ── SAVE / UPDATE AGENT ───────────────────────────────────────
function saveCustomAgent() {
  const name = UI.customAgentName.value.trim();
  const icon = UI.customAgentIcon.value.trim() || "✦";
  const description = UI.customAgentDesc.value.trim();
  const systemPrompt = UI.customAgentPrompt.value.trim();

  // Validation
  if (!name) { flashError(UI.customAgentName, "Name is required"); return; }
  if (!description) { flashError(UI.customAgentDesc, "Description is required"); return; }
  if (!systemPrompt) { flashError(UI.customAgentPrompt, "System prompt is required"); return; }

  if (UI.editingId) {
    // Update existing
    customAgents = customAgents.map(a =>
      a.id === UI.editingId
        ? { ...a, name, icon, description, systemPrompt, updatedAt: Date.now() }
        : a
    );
  } else {
    // Create new
    customAgents.push({
      id: "custom_" + Date.now(),
      name,
      icon,
      description,
      systemPrompt,
      createdAt: Date.now(),
    });
  }

  saveCustomAgents(customAgents);
  renderCustomAgents();
  closeModal();

  // Auto-select the new/updated agent
  if (!UI.editingId) {
    const newest = customAgents[customAgents.length - 1];
    switchAgent(newest.id);
  }
}

// ── DELETE AGENT ──────────────────────────────────────────────
function deleteCustomAgent(id) {
  if (!confirm("Delete this agent? This cannot be undone.")) return;
  customAgents = customAgents.filter(a => a.id !== id);
  saveCustomAgents(customAgents);

  // If deleted agent was active, switch to summarizer
  if (UI.currentAgent === id) switchAgent("summarizer");
  renderCustomAgents();
}

// ── VALIDATION FLASH ──────────────────────────────────────────
function flashError(el, msg) {
  el.classList.add("input-error");
  el.placeholder = msg;
  el.focus();
  setTimeout(() => el.classList.remove("input-error"), 1500);
}

// ── CHAR COUNT ────────────────────────────────────────────────
function updateCharCount() {
  const len = UI.userInput.value.length;
  UI.charCount.textContent =
    len === 0 ? "0 characters" :
      len === 1 ? "1 character" :
        `${len.toLocaleString()} characters`;
}

// ── CLEAR INPUT ───────────────────────────────────────────────
function clearInput() {
  UI.userInput.value = "";
  updateCharCount();
  UI.showOutput("idle");
  UI.userInput.focus();
}

// ── EVENT LISTENERS ───────────────────────────────────────────

// Built-in agent tabs
UI.agentTabs.forEach(tab => {
  tab.addEventListener("click", () => switchAgent(tab.dataset.agent));
});

// Open modal button
document.getElementById("openModalBtn").addEventListener("click", () => openModal());

// Modal close
document.getElementById("modalClose").addEventListener("click", closeModal);
document.getElementById("modalCancel").addEventListener("click", closeModal);

// Close on backdrop click
UI.modalOverlay.addEventListener("click", e => {
  if (e.target === UI.modalOverlay) closeModal();
});

// Close on Escape key
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && UI.modalOverlay.classList.contains("open")) closeModal();
});

// Save agent
document.getElementById("modalSave").addEventListener("click", saveCustomAgent);

// Emoji preset buttons
document.querySelectorAll(".emoji-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    UI.customAgentIcon.value = btn.dataset.emoji;
  });
});

// Run button
UI.runBtn.addEventListener("click", runAgent);

// Ctrl/Cmd + Enter to run
UI.userInput.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") runAgent();
});

// Clear
UI.clearBtn.addEventListener("click", clearInput);

// Copy
UI.copyBtn.addEventListener("click", copyOutput);

// Retry
UI.retryBtn.addEventListener("click", runAgent);

// Char count
UI.userInput.addEventListener("input", updateCharCount);

// ── INIT ──────────────────────────────────────────────────────
renderCustomAgents();
switchAgent("summarizer");

console.log(
  "%c AI Agent Hub %c Ready ",
  "background:#f0a832;color:#0d0d0f;padding:2px 6px;border-radius:3px;font-weight:bold",
  "background:#1c1c22;color:#f0a832;padding:2px 6px;border-radius:3px"
);