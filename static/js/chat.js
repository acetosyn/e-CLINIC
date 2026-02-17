/* ===========================================================
   EPICONSULT e-CLINIC — CHAT.JS (UPGRADED v1.2)
   Inbox + Conversation Messaging
   Deduplicated • Optimistic • Better UX (typing, autosend, smart scroll)
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
  const typingEl  = document.getElementById("typing-indicator");

  // find the send button inside the form (no HTML change needed)
  const sendBtn = chatForm ? chatForm.querySelector('button[type="submit"]') : null;

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

  function isNearBottom(threshold = 90) {
    // if user is close enough to the bottom, allow auto-scroll
    const distanceFromBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
    return distanceFromBottom < threshold;
  }

  function scrollBottom(force = false) {
    if (force || isNearBottom()) {
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  }

  function clearChat() {
    chatArea.innerHTML = "";
    seenMessageIds.clear();
  }

  function setTyping(isTyping) {
    if (!typingEl) return;
    typingEl.classList.toggle("hidden", !isTyping);
  }

  function updateSendState() {
    if (!sendBtn) return;

    const textOk = chatInput.value.trim().length > 0;
    const deptOk = !!activeDept;

    sendBtn.disabled = !(textOk && deptOk);
    sendBtn.style.opacity = sendBtn.disabled ? "0.55" : "1";
    sendBtn.style.cursor = sendBtn.disabled ? "not-allowed" : "pointer";
  }

  function renderSystem(text) {
    clearChat();
    chatArea.innerHTML = `
      <article class="chat-message system-message">
        <p>${text}</p>
      </article>
    `;
    scrollBottom(true);
  }

  /* -------------------------------------------------------
     RENDER MESSAGE (DEDUP + TYPEWRITER + FAIL STATE)
  ------------------------------------------------------- */
  function renderMessage({ id, mine, message, timestamp, label, status, clientId }) {

    // 🚫 Dedup server messages (never duplicate)
    if (id) {
      if (seenMessageIds.has(id)) return;
      seenMessageIds.add(id);
    }

    const bubble = document.createElement("article");
    bubble.className = `chat-message ${mine ? "sent" : "received"}`;

    // attach clientId so we can update this bubble (optimistic send)
    if (clientId) bubble.dataset.clientId = clientId;

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

    // Optional status marker (only used if failed)
    if (status === "failed") {
      const fail = document.createElement("span");
      fail.className = "chat-time";
      fail.textContent = "Failed • retry";
      fail.style.opacity = "0.9";
      fail.style.fontWeight = "700";
      fail.style.cursor = "pointer";
      fail.style.marginLeft = "0.5rem";

      // retry handler (re-send same message)
      fail.addEventListener("click", () => {
        if (!activeDept) return;
        sendMessageToDept(activeDept, message, bubble);
      });

      bubble.appendChild(fail);
    }

    bubble.appendChild(time);
    chatArea.appendChild(bubble);
    scrollBottom();

    /* -------------------------------------------
       TYPEWRITER EFFECT (incoming only)
    ------------------------------------------- */
    if (mine) {
      textSpan.textContent = message; // your messages appear instantly
      return;
    }

    setTyping(true);

    let i = 0;
    const speed = 14; // slightly faster (smoother)

    function typeChar() {
      if (i < message.length) {
        textSpan.textContent += message.charAt(i);
        i++;
        scrollBottom();
        setTimeout(typeChar, speed);
      } else {
        // hide typing shortly after finishing
        setTimeout(() => setTyping(false), 250);
      }
    }

    typeChar();
  }

  function markBubbleFailed(bubbleEl) {
    if (!bubbleEl) return;

    // avoid adding twice
    if (bubbleEl.dataset.failed === "1") return;
    bubbleEl.dataset.failed = "1";

    // add a small failed pill
    const fail = document.createElement("span");
    fail.className = "chat-time";
    fail.textContent = "Failed • retry";
    fail.style.opacity = "0.9";
    fail.style.fontWeight = "700";
    fail.style.cursor = "pointer";
    fail.style.marginLeft = "0.5rem";

    // read message text from bubble
    const msgText = bubbleEl.querySelector("p span")?.textContent || "";
    fail.addEventListener("click", () => {
      if (!activeDept) return;
      sendMessageToDept(activeDept, msgText, bubbleEl);
    });

    bubbleEl.appendChild(fail);
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
     2️⃣ INBOX MODE
  ------------------------------------------------------- */
  async function loadInbox() {
    activeDept = null;
    lastTimestamp = null;

    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    clearChat();
    updateSendState();

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

      scrollBottom(true);

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
    updateSendState();

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

      scrollBottom(true);

    } catch (e) {
      console.error("❌ Conversation load failed", e);
    }
  }

  /* -------------------------------------------------------
     SEND MESSAGE (Optimistic + Retry)
  ------------------------------------------------------- */
  async function sendMessageToDept(dept, text, bubbleElToUpdate = null) {
    const now = new Date().toISOString();

    // if this is a retry, remove failed marker
    if (bubbleElToUpdate) {
      bubbleElToUpdate.dataset.failed = "0";
      // remove any "Failed • retry" labels
      bubbleElToUpdate.querySelectorAll(".chat-time").forEach((el) => {
        if ((el.textContent || "").toLowerCase().includes("failed")) el.remove();
      });
    }

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: dept, message: text })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("❌ Send failed:", err.error || "Unknown error");
        markBubbleFailed(bubbleElToUpdate);
        return false;
      }

      lastTimestamp = now;
      return true;

    } catch (e) {
      console.error("❌ Network send error", e);
      markBubbleFailed(bubbleElToUpdate);
      return false;
    }
  }

  /* -------------------------------------------------------
     4️⃣ SUBMIT HANDLER (OPTIMISTIC)
  ------------------------------------------------------- */
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = chatInput.value.trim();
    if (!text || !activeDept) return;

    const now = new Date().toISOString();

    // render optimistic bubble and keep reference
    const clientId = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    renderMessage({
      mine: true,
      message: text,
      timestamp: now,
      clientId
    });

    const optimisticBubble = chatArea.querySelector(`[data-client-id="${clientId}"]`);

    chatInput.value = "";
    updateSendState();
    scrollBottom(true);

    const ok = await sendMessageToDept(activeDept, text, optimisticBubble);

    // if failed, mark on the bubble
    if (!ok) {
      markBubbleFailed(optimisticBubble);
    }
  });

  /* -------------------------------------------------------
     Enter to send, Shift+Enter newline
  ------------------------------------------------------- */
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // only submit if enabled
      if (sendBtn && !sendBtn.disabled) {
        chatForm.requestSubmit();
      }
    }
  });

  chatInput.addEventListener("input", updateSendState);

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

      if (!messages.length) return;

      const shouldStickToBottom = isNearBottom(120);

      messages.forEach(m => {
        renderMessage({
          id: m.id,
          mine: false,
          message: m.message,
          timestamp: m.timestamp
        });

        lastTimestamp = m.timestamp;
      });

      // only force scroll if user was already near bottom
      if (shouldStickToBottom) scrollBottom(true);

    } catch (e) {
      console.error("❌ Polling error", e);
    }
  }

  /* -------------------------------------------------------
     6️⃣ DEPARTMENT CHANGE
  ------------------------------------------------------- */
  deptSelect.addEventListener("change", () => {
    activeDept = deptSelect.value;
    updateSendState();

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
  updateSendState();

});
