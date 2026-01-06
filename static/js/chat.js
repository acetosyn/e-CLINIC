/* ===========================================================
   EPICONSULT e-CLINIC — CHAT.JS (FINAL v1.1)
   Inbox + Conversation Messaging
   Deduplicated • Optimistic • WhatsApp-style UX
   Backend: /api/chat/*
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* -------------------------------------------------------
     ELEMENTS
  ------------------------------------------------------- */
  const deptSelect = document.getElementById("chat-dept-select");
  const chatForm  = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-message-input");
  const chatArea  = document.getElementById("chat-messages-area");
  const clearBtn  = document.getElementById("clearChatBtn");

  let activeDept     = null;
  let lastTimestamp  = null;
  let pollTimer      = null;
  let seenMessageIds = new Set();

  if (!deptSelect || !chatForm || !chatInput || !chatArea) {
    console.warn("💬 Chat UI elements missing — chat.js aborted");
    return;
  }

  /* -------------------------------------------------------
     UTILITIES
  ------------------------------------------------------- */
  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function scrollBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function clearChat() {
    chatArea.innerHTML = "";
    seenMessageIds.clear();
  }

  function renderSystem(text) {
    clearChat();
    chatArea.innerHTML = `
      <article class="chat-message system-message">
        <p>${text}</p>
      </article>
    `;
  }

/* -------------------------------------------------------
   RENDER MESSAGE (DEDUP + TYPEWRITER)
------------------------------------------------------- */
function renderMessage({ id, mine, message, timestamp, label }) {

  // 🚫 HARD STOP — no duplicates ever
  if (id) {
    if (seenMessageIds.has(id)) return;
    seenMessageIds.add(id);
  }

  const bubble = document.createElement("article");
  bubble.className = `chat-message ${mine ? "sent" : "received"}`;

  // Message container
  const p = document.createElement("p");

  // Optional label (Inbox mode)
  if (label) {
    const strong = document.createElement("strong");
    strong.textContent = label;
    p.appendChild(strong);
    p.appendChild(document.createElement("br"));
  }

  // Text span (for typewriter)
  const textSpan = document.createElement("span");
  p.appendChild(textSpan);

  // Timestamp
  const time = document.createElement("span");
  time.className = "chat-time";
  time.textContent = formatTime(timestamp);

  bubble.appendChild(p);
  bubble.appendChild(time);
  chatArea.appendChild(bubble);
  scrollBottom();

  /* -------------------------------------------
     TYPEWRITER EFFECT (incoming only)
  ------------------------------------------- */
  if (mine) {
    // 🔹 Your messages appear instantly
    textSpan.textContent = message;
    return;
  }

  // 🔹 Incoming messages type out
  let i = 0;
  const speed = 18; // typing speed (lower = faster)

  function typeChar() {
    if (i < message.length) {
      textSpan.textContent += message.charAt(i);
      i++;
      scrollBottom();
      setTimeout(typeChar, speed);
    }
  }

  typeChar();
}


  /* -------------------------------------------------------
     1️⃣ LOAD DEPARTMENTS
  ------------------------------------------------------- */
  async function loadDepartments() {
    try {
      const res = await fetch("/api/chat/departments");
      const depts = await res.json();

      deptSelect.innerHTML = `<option value="">📥 Inbox</option>`;

      depts.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.value;
        opt.textContent = d.label;
        deptSelect.appendChild(opt);
      });
    } catch (e) {
      console.error("❌ Department load failed", e);
    }
  }

  /* -------------------------------------------------------
     2️⃣ INBOX MODE (AUTO DROP)
  ------------------------------------------------------- */
  async function loadInbox() {
    activeDept = null;
    lastTimestamp = null;

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    clearChat();

    try {
      const res = await fetch("/api/chat/inbox");
      const messages = await res.json();

      if (!messages.length) {
        renderSystem("No new messages.");
        return;
      }

      messages.forEach(m => {
        renderMessage({
          id: m.id,
          mine: false,
          message: m.message,
          timestamp: m.timestamp,
          label: m.sender.replace("_", " ").toUpperCase()
        });
      });

    } catch (e) {
      console.error("❌ Inbox load failed", e);
    }
  }

  /* -------------------------------------------------------
     3️⃣ LOAD CONVERSATION
  ------------------------------------------------------- */
  async function loadConversation(dept) {
    if (!dept) return;

    clearChat();
    lastTimestamp = null;

    try {
      const res = await fetch(`/api/chat/conversation?department=${dept}`);
      const messages = await res.json();

      if (!messages.length) {
        renderSystem("No messages yet.");
        return;
      }

      messages.forEach(m => {
        renderMessage({
          id: m.id,
          mine: m.sender !== dept,
          message: m.message,
          timestamp: m.timestamp
        });

        lastTimestamp = m.timestamp;
      });

    } catch (e) {
      console.error("❌ Conversation load failed", e);
    }
  }

  /* -------------------------------------------------------
     4️⃣ SEND MESSAGE (OPTIMISTIC)
  ------------------------------------------------------- */
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = chatInput.value.trim();
    if (!text || !activeDept) return;

    const now = new Date().toISOString();

    // ✅ render ONCE (no id yet)
    renderMessage({
      mine: true,
      message: text,
      timestamp: now
    });

    chatInput.value = "";
    lastTimestamp = now;

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: activeDept, message: text })
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("❌ Send failed:", err.error);
      }

    } catch (e) {
      console.error("❌ Network send error", e);
    }
  });

  /* -------------------------------------------------------
     5️⃣ POLLING (INBOUND ONLY)
  ------------------------------------------------------- */
  async function pollMessages() {
    if (!activeDept || !lastTimestamp) return;

    try {
      const res = await fetch(
        `/api/chat/poll?department=${activeDept}&since=${lastTimestamp}`
      );
      const messages = await res.json();

      messages.forEach(m => {
        renderMessage({
          id: m.id,
          mine: false,
          message: m.message,
          timestamp: m.timestamp
        });

        lastTimestamp = m.timestamp;
      });

    } catch (e) {
      console.error("❌ Polling error", e);
    }
  }

  /* -------------------------------------------------------
     6️⃣ DEPARTMENT CHANGE
  ------------------------------------------------------- */
  deptSelect.addEventListener("change", () => {
    activeDept = deptSelect.value;

    if (!activeDept) {
      loadInbox();
      return;
    }

    loadConversation(activeDept);

    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(pollMessages, 2500);
  });

  /* -------------------------------------------------------
     7️⃣ CLEAR CHAT (HARD DELETE)
  ------------------------------------------------------- */
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {

      if (!activeDept) {
        renderSystem("Inbox cleared.");
        return;
      }

      if (!confirm("Clear this conversation permanently?")) return;

      try {
        const res = await fetch("/api/chat/clear", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ department: activeDept })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Clear failed");

        lastTimestamp = null;
        renderSystem("Conversation cleared.");

      } catch (err) {
        console.error("❌ Clear failed", err);
        alert("Failed to clear conversation.");
      }
    });
  }

  /* -------------------------------------------------------
     INIT
  ------------------------------------------------------- */
  loadDepartments();
  loadInbox();

});
