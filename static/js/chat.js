/* ===========================================================
   EPICONSULT e-CLINIC — CHAT.JS (MODAL v3.5)
   Built on OLD v3.3 (the one that renders inbox history correctly)

   Added / Fixed:
   ✅ Inbox history ALWAYS renders (safe dedup reset on full reload)
   ✅ Remember last opened view (Inbox or last Department) via localStorage
   ✅ Remember draft text per view (Inbox / each department) via localStorage
   ✅ Stable unread (by message IDs Set) — no "+= length" bouncing
   ✅ Clicking floating button marks inbox as read (your request) BUT keeps history visible
   ✅ Typewriter “jump/glitch” reduced: typing indicator no longer collapses layout
      + scroll only sticks if user was near bottom when typing started
   ✅ Anti-spam: prevents double-send while request in flight
=========================================================== */

document.addEventListener("DOMContentLoaded", () => {

  /* -------------------------------------------------------
     ELEMENTS (Modal)
  ------------------------------------------------------- */
  const overlay   = document.getElementById("chatModalOverlay");
  const modal     = overlay ? overlay.querySelector(".chat-modal") : null;
  const closeBtn  = document.getElementById("chatModalCloseBtn");

  const deptSelect = document.getElementById("chat-dept-select");
  const chatForm   = document.getElementById("chat-form");
  const chatInput  = document.getElementById("chat-message-input");
  const chatArea   = document.getElementById("chat-messages-area");
  const clearBtn   = document.getElementById("clearChatBtn");
  const typingEl   = document.getElementById("typing-indicator");
  const inboxBtn   = document.getElementById("chatInboxBtn");

  const replyPill = document.getElementById("chatReplyPill");
  const replyText = document.getElementById("chatReplyText");
  const replyClearBtn = document.getElementById("chatReplyClearBtn");
  const charCount = document.getElementById("chatCharCount");

  const connPill  = document.getElementById("chat-conn-pill");

  // Floating button + badge
  const floatBtn   = document.getElementById("floating-chat-button");
  const floatBadge = document.getElementById("chat-notif-badge");

  // Inbox badge in header (mini badge)
  const inboxBadge = document.getElementById("chatInboxBadge");

  const sendBtn = chatForm ? chatForm.querySelector('button[type="submit"]') : null;

  // Emergency banner (used as modern toast/alert host)
  const emergencyBanner = document.getElementById("emergency-banner");
  const emergencyMsg    = document.getElementById("emergency-message");
  const emergencyClose  = emergencyBanner ? emergencyBanner.querySelector(".emergency-close") : null;
  const emergencyTitle  = document.getElementById("emergency-title");   // optional
  const emergencyCount  = document.getElementById("emergency-count");   // optional
  const emergencyIcon   = document.getElementById("emergency-icon");    // optional

  if (!deptSelect || !chatForm || !chatInput || !chatArea || !overlay) {
    console.warn("💬 Chat modal UI elements missing — chat.js aborted");
    return;
  }

  /* -------------------------------------------------------
     STATE
  ------------------------------------------------------- */
  let activeDept         = null;  // conversation mode when set
  let replyTargetDept    = null;  // inbox quick reply target
  let lastConvTimestamp  = null;
  let lastInboxTimestamp = null;
  let pollTimer          = null;

  // Dedup IDs (only for incremental polling; we reset on full reload)
  const seenMessageIds = new Set();

  // Stable unread tracking by message IDs (no bouncing)
  const inboxUnreadIds = new Set();

  // Anti-double-send
  let inFlightSend = false;

  /* -------------------------------------------------------
     STORAGE KEYS
  ------------------------------------------------------- */
  const STORAGE_SEEN_KEY      = "epiconsult_chat_seen_inbox_ts";
  const STORAGE_LAST_VIEW_KEY = "epiconsult_chat_last_view";          // "" = inbox, else dept slug
  const STORAGE_DRAFT_KEY     = "epiconsult_chat_draft_v1";           // JSON map {key:text}

  let lastSeenInboxTs = loadSeenInboxTs();  // ISO string or null
  let unreadCount = 0;

  /* -------------------------------------------------------
     UTILITIES
  ------------------------------------------------------- */
  const esc = (s) => String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  function normalizeDeptLabel(slug) {
    return String(slug || "")
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  }

  function isoToMs(iso) {
    const t = Date.parse(iso || "");
    return Number.isFinite(t) ? t : 0;
  }

  function isNearBottom(threshold = 110) {
    const distance = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
    return distance < threshold;
  }

  function scrollBottom(force = false) {
    if (force || isNearBottom()) {
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  }

  function clearChatArea() {
    chatArea.innerHTML = "";
  }

  function resetHistoryRenderState() {
    // KEY FIX: if we do a full reload, we must clear dedup,
    // otherwise "history" can appear empty after a clear/reload cycle.
    seenMessageIds.clear();
  }

  function setSendHint(text) {
    chatInput.placeholder = text || "Type a message…";
  }

  function currentMode() {
    return activeDept ? "conversation" : "inbox";
  }

  function viewKey() {
    // used for draft memory
    return activeDept ? `dept:${activeDept}` : "inbox";
  }

  /* -------------------------------------------------------
     Typing indicator: do NOT change layout height (prevents jump)
  ------------------------------------------------------- */
  const typingHeight = (() => {
    if (!typingEl) return 0;
    // preserve its natural height if visible; otherwise fallback
    const r = typingEl.getBoundingClientRect();
    return Math.max(18, Math.round(r.height || 18));
  })();

  function setTyping(isTyping) {
    if (!typingEl) return;

    // ensure it always reserves space; no collapse = no jump
    typingEl.style.minHeight = `${typingHeight}px`;
    typingEl.style.display = "block";

    if (isTyping) {
      typingEl.style.visibility = "visible";
      typingEl.style.opacity = "1";
    } else {
      typingEl.style.visibility = "hidden";
      typingEl.style.opacity = "0";
    }
  }

  function setConn(state) {
    if (!connPill) return;
    connPill.dataset.state = state;
    const icon = connPill.querySelector("i");
    const label = connPill.querySelector("span");

    if (state === "offline") {
      if (icon) icon.className = "fa-solid fa-triangle-exclamation";
      if (label) label.textContent = "Offline";
    } else {
      if (icon) icon.className = "fa-solid fa-wifi";
      if (label) label.textContent = "Online";
    }
  }

  function updateSendState() {
    if (!sendBtn) return;

    const textOk = chatInput.value.trim().length > 0;
    const targetOk = currentMode() === "conversation" ? !!activeDept : !!replyTargetDept;

    sendBtn.disabled = !(textOk && targetOk) || inFlightSend;
    sendBtn.style.opacity = sendBtn.disabled ? "0.55" : "1";
    sendBtn.style.cursor = sendBtn.disabled ? "not-allowed" : "pointer";
  }

  function renderSystem(text) {
    clearChatArea();
    resetHistoryRenderState();
    chatArea.innerHTML = `
      <article class="chat-message system-message">
        <p>${esc(text)}</p>
      </article>
    `;
    scrollBottom(true);
  }

  /* -------------------------------------------------------
     SEEN / UNREAD (timestamp + ID set)
  ------------------------------------------------------- */
  function loadSeenInboxTs() {
    const v = localStorage.getItem(STORAGE_SEEN_KEY);
    return v && String(v).trim() ? String(v) : null;
  }

  function saveSeenInboxTs(iso) {
    if (!iso) return;
    lastSeenInboxTs = iso;
    localStorage.setItem(STORAGE_SEEN_KEY, iso);
  }

  function markAllInboxRead() {
    const newest = lastInboxTimestamp || new Date().toISOString();
    saveSeenInboxTs(newest);
    inboxUnreadIds.clear();
    setUnreadCount(0, { silentBanner: true });
    hideChatAlertBanner();
  }

  function computeUnreadSetFromInbox(messages) {
    inboxUnreadIds.clear();

    const seenMs = isoToMs(lastSeenInboxTs);
    if (!Array.isArray(messages) || !messages.length) return;

    // first time: treat existing messages as unread until user opens
    if (!seenMs) {
      for (const m of messages) if (m?.id != null) inboxUnreadIds.add(String(m.id));
      return;
    }

    for (const m of messages) {
      const mid = m?.id;
      const ts  = m?.timestamp;
      if (mid == null) continue;
      if (isoToMs(ts) > seenMs) inboxUnreadIds.add(String(mid));
    }
  }

  /* -------------------------------------------------------
     BADGES (mini + floating)
  ------------------------------------------------------- */
  function setBadge(el, count) {
    if (!el) return;
    const c = Number(count || 0);
    el.textContent = String(c);
    el.classList.toggle("hidden", c <= 0);
  }

  function setUnreadCount(count, opts = {}) {
    unreadCount = Math.max(0, Number(count || 0));

    setBadge(inboxBadge, unreadCount);

    if (floatBadge) {
      floatBadge.textContent = String(unreadCount);
      floatBadge.style.display = unreadCount > 0 ? "grid" : "none";
    }

    if (!opts.silentBanner) {
      if (unreadCount > 0) showChatAlertBanner(unreadCount);
      else hideChatAlertBanner();
    }
  }

  function showFloatingButton(show) {
    if (!floatBtn) return;
    floatBtn.hidden = !show;
  }

  /* -------------------------------------------------------
     LAST VIEW MEMORY (Inbox / Dept)
  ------------------------------------------------------- */
  function saveLastView(val) {
    // "" = inbox, else dept slug
    localStorage.setItem(STORAGE_LAST_VIEW_KEY, String(val ?? ""));
  }

  function loadLastView() {
    const v = localStorage.getItem(STORAGE_LAST_VIEW_KEY);
    return v == null ? "" : String(v);
  }

  /* -------------------------------------------------------
     DRAFT MEMORY (per view)
  ------------------------------------------------------- */
  function loadDraftMap() {
    try {
      const raw = localStorage.getItem(STORAGE_DRAFT_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === "object") ? obj : {};
    } catch {
      return {};
    }
  }

  function saveDraftMap(map) {
    try {
      localStorage.setItem(STORAGE_DRAFT_KEY, JSON.stringify(map || {}));
    } catch {}
  }

  function saveDraftForCurrentView() {
    const map = loadDraftMap();
    map[viewKey()] = chatInput.value || "";
    saveDraftMap(map);
  }

  function restoreDraftForCurrentView() {
    const map = loadDraftMap();
    const v = map[viewKey()];
    if (typeof v === "string") {
      chatInput.value = v;
      if (charCount) charCount.textContent = `${chatInput.value.length}/500`;
    }
    updateSendState();
  }

  /* -------------------------------------------------------
     MODAL OPEN/CLOSE
  ------------------------------------------------------- */
  function openChatModal({ forceInbox = false } = {}) {
    overlay.classList.remove("hidden");
    overlay.setAttribute("aria-hidden", "false");
    showFloatingButton(false);

    // Your request: clicking floating icon marks inbox read immediately.
    // We DO NOT wipe history; we just mark read.
    markAllInboxRead();

    if (forceInbox) {
      deptSelect.value = "";
      saveLastView("");
      // Full load inbox (safe)
      loadInbox({ markReadOnLoad: true, forceReload: true });
    } else {
      // Restore last view if no current activeDept
      const last = loadLastView();

      if (last && last.trim()) {
        deptSelect.value = last;
        loadConversation(last, { forceReload: chatArea.children.length === 0 });
      } else {
        deptSelect.value = "";
        // If chat area is empty (first open), load inbox; otherwise keep what is already rendered.
        if (chatArea.children.length === 0) loadInbox({ markReadOnLoad: true, forceReload: true });
      }
    }

    restoreDraftForCurrentView();
    setTimeout(() => chatInput.focus(), 80);
  }

  function closeChatModal() {
    saveDraftForCurrentView();
    overlay.classList.add("hidden");
    overlay.setAttribute("aria-hidden", "true");
    showFloatingButton(true);
  }

  // open via floating
  if (floatBtn) {
    showFloatingButton(true);
    floatBtn.addEventListener("click", () => openChatModal());
  }

  // close btn
  if (closeBtn) closeBtn.addEventListener("click", closeChatModal);

  // close on overlay click (not when clicking inside modal)
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeChatModal();
  });

  // close on ESC
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) {
      closeChatModal();
    }
  });

  /* -------------------------------------------------------
     CHAR COUNTER + DRAFT SAVE
  ------------------------------------------------------- */
  if (charCount) {
    chatInput.addEventListener("input", () => {
      charCount.textContent = `${chatInput.value.length}/500`;
      saveDraftForCurrentView();
    });
  } else {
    chatInput.addEventListener("input", saveDraftForCurrentView);
  }

  /* -------------------------------------------------------
     RENDER: message bubble
     (Typewriter without layout jumps + sticky scroll logic)
  ------------------------------------------------------- */
  function renderMessage({ id, mine, message, timestamp, label, status, clientId, meta }) {
    const sid = (id != null) ? String(id) : null;

    if (sid) {
      if (seenMessageIds.has(sid)) return null;
      seenMessageIds.add(sid);
    }

    const bubble = document.createElement("article");
    bubble.className = `chat-message ${mine ? "sent" : "received"}`;

    if (sid) bubble.dataset.msgId = sid;
    if (meta?.from) bubble.dataset.fromDept = meta.from;
    if (clientId) bubble.dataset.clientId = clientId;

    const p = document.createElement("p");

    if (label) {
      const strong = document.createElement("strong");
      strong.textContent = label;
      p.appendChild(strong);
      p.appendChild(document.createElement("br"));
    }

    const textSpan = document.createElement("span");
    p.appendChild(textSpan);

    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = formatTime(timestamp);

    bubble.appendChild(p);

    if (status === "failed") {
      const fail = document.createElement("span");
      fail.className = "chat-time";
      fail.textContent = "Failed • retry";
      fail.style.opacity = "0.9";
      fail.style.fontWeight = "700";
      fail.style.cursor = "pointer";
      fail.style.marginLeft = "0.5rem";

      fail.addEventListener("click", () => {
        const msgText = message;
        const target = currentMode() === "conversation" ? activeDept : replyTargetDept;
        if (!target) return;
        if (currentMode() === "conversation") sendToConversation(target, msgText, bubble);
        else sendReplyFromInbox(target, msgText, bubble);
      });

      bubble.appendChild(fail);
    }

    bubble.appendChild(time);
    chatArea.appendChild(bubble);

    if (mine) {
      textSpan.textContent = message;
      scrollBottom();
      return bubble;
    }

    // Typewriter for incoming bubbles:
    const shouldStick = isNearBottom(160); // capture BEFORE typing begins
    setTyping(true);

    let i = 0;
    const speed = 12;

    function typeChar() {
      if (i < message.length) {
        textSpan.textContent += message.charAt(i);
        i++;
        if (shouldStick) scrollBottom(true);
        setTimeout(typeChar, speed);
      } else {
        // keep indicator space reserved, just hide visually (no jump)
        setTimeout(() => setTyping(false), 180);
        if (shouldStick) scrollBottom(true);
      }
    }
    typeChar();

    return bubble;
  }

  function markBubbleFailed(bubbleEl) {
    if (!bubbleEl) return;
    if (bubbleEl.dataset.failed === "1") return;
    bubbleEl.dataset.failed = "1";

    const existing = Array.from(bubbleEl.querySelectorAll(".chat-time"))
      .some(el => (el.textContent || "").toLowerCase().includes("failed"));
    if (existing) return;

    const fail = document.createElement("span");
    fail.className = "chat-time";
    fail.textContent = "Failed • retry";
    fail.style.opacity = "0.9";
    fail.style.fontWeight = "700";
    fail.style.cursor = "pointer";
    fail.style.marginLeft = "0.5rem";

    const msgText = bubbleEl.querySelector("p span")?.textContent || "";
    fail.addEventListener("click", () => {
      const target = currentMode() === "conversation" ? activeDept : replyTargetDept;
      if (!target) return;
      if (currentMode() === "conversation") sendToConversation(target, msgText, bubbleEl);
      else sendReplyFromInbox(target, msgText, bubbleEl);
    });

    bubbleEl.appendChild(fail);
  }

  function clearFailedMarker(bubbleEl) {
    if (!bubbleEl) return;
    bubbleEl.dataset.failed = "0";
    bubbleEl.querySelectorAll(".chat-time").forEach((el) => {
      if ((el.textContent || "").toLowerCase().includes("failed")) el.remove();
    });
  }

  /* -------------------------------------------------------
     INBOX: Reply target pill
  ------------------------------------------------------- */
  function setInboxReplyTarget(deptSlug, label = null) {
    replyTargetDept = deptSlug || null;

    if (!replyPill || !replyText) return;

    if (replyTargetDept) {
      const nice = label || normalizeDeptLabel(replyTargetDept);
      replyText.textContent = `Replying to: ${nice}`;
      replyPill.classList.remove("hidden");
      setSendHint(`Reply to ${nice}…`);
    } else {
      replyPill.classList.add("hidden");
      setSendHint("Type a message…");
    }
  }

  if (replyClearBtn) {
    replyClearBtn.addEventListener("click", () => {
      setInboxReplyTarget(null);
      saveLastView(""); // still inbox
      updateSendState();
      restoreDraftForCurrentView();
    });
  }

  /* -------------------------------------------------------
     BANNER (Modern emergency container used for chat notice)
  ------------------------------------------------------- */
  function showChatAlertBanner(count) {
    if (!emergencyBanner || !emergencyMsg) return;

    emergencyBanner.hidden = false;
    emergencyBanner.classList.add("is-chat-alert");
    emergencyBanner.classList.add("is-flashing");

    if (emergencyIcon) emergencyIcon.className = "fa-solid fa-comment-dots";
    if (emergencyTitle) emergencyTitle.textContent = "New message";
    if (emergencyCount) emergencyCount.textContent = String(count);

    emergencyMsg.textContent =
      count === 1 ? "You have 1 unread message in Inbox." : `You have ${count} unread messages in Inbox.`;

    emergencyBanner.onclick = (e) => {
      if (e.target && (e.target.closest && e.target.closest(".emergency-close"))) return;
      openChatModal({ forceInbox: true });
    };
  }

  function hideChatAlertBanner() {
    if (!emergencyBanner) return;
    emergencyBanner.classList.remove("is-flashing");
    emergencyBanner.classList.remove("is-chat-alert");
    emergencyBanner.hidden = true;
    emergencyBanner.onclick = null;
  }

  if (emergencyClose) {
    emergencyClose.addEventListener("click", (e) => {
      e.preventDefault();
      emergencyBanner.classList.remove("is-flashing");
      emergencyBanner.hidden = true; // acknowledge only, not read
    });
  }

  /* -------------------------------------------------------
     API: Load departments
  ------------------------------------------------------- */
  async function loadDepartments() {
    try {
      const res = await fetch("/api/chat/departments");
      if (!res.ok) throw new Error("dept load failed");
      const depts = await res.json();

      deptSelect.innerHTML = `<option value="">📥 Inbox</option>`;
      (depts || []).forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.value;
        opt.textContent = d.label;
        deptSelect.appendChild(opt);
      });

      setConn("online");

      // After departments are loaded, restore last selection in dropdown
      const last = loadLastView();
      if (last && last.trim()) deptSelect.value = last;

    } catch (e) {
      console.error("❌ Department load failed", e);
      setConn("offline");
    }
  }

  /* -------------------------------------------------------
     MODE: Inbox
     - forceReload: true will clear+re-render safely
  ------------------------------------------------------- */
  async function loadInbox({ markReadOnLoad = false, forceReload = false } = {}) {
    activeDept = null;
    lastConvTimestamp = null;
    saveLastView("");

    // Only full reset if explicitly requested or we don't have content yet
    if (forceReload || chatArea.children.length === 0) {
      clearChatArea();
      resetHistoryRenderState();
    }

    setInboxReplyTarget(null);
    updateSendState();
    restoreDraftForCurrentView();

    try {
      const msgRes = await fetch("/api/chat/inbox?limit=160");
      const messages = await msgRes.json().catch(() => []);

      if (!Array.isArray(messages) || !messages.length) {
        if (forceReload || chatArea.children.length === 0) renderSystem("No new messages.");
        lastInboxTimestamp = new Date().toISOString();

        inboxUnreadIds.clear();
        setUnreadCount(0, { silentBanner: true });
        hideChatAlertBanner();

        armPolling();
        setConn("online");
        return;
      }

      lastInboxTimestamp = messages[messages.length - 1]?.timestamp || new Date().toISOString();

      if (forceReload || chatArea.children.length === 0) {
        // Render history
        messages.forEach(m => {
          const from = m.sender;
          renderMessage({
            id: m.id,
            mine: false,
            message: m.message,
            timestamp: m.timestamp,
            label: normalizeDeptLabel(from),
            meta: { from }
          });
        });

        const latestSender = messages[messages.length - 1]?.sender;
        if (latestSender) setInboxReplyTarget(latestSender, normalizeDeptLabel(latestSender));

        scrollBottom(true);
      }

      const modalOpen = !overlay.classList.contains("hidden");
      if (markReadOnLoad || modalOpen) {
        markAllInboxRead();
      } else {
        computeUnreadSetFromInbox(messages);
        setUnreadCount(inboxUnreadIds.size);
      }

      updateSendState();
      armPolling();
      setConn("online");

    } catch (e) {
      console.error("❌ Inbox load failed", e);
      if (forceReload || chatArea.children.length === 0) renderSystem("Failed to load inbox.");
      armPolling();
      setConn("offline");
    }
  }

  /* -------------------------------------------------------
     MODE: Conversation
     - forceReload: true will clear+re-render safely
  ------------------------------------------------------- */
  async function loadConversation(dept, { forceReload = true } = {}) {
    if (!dept) return;

    activeDept = dept;
    saveLastView(dept);
    setInboxReplyTarget(null);

    if (forceReload) {
      clearChatArea();
      resetHistoryRenderState();
    }

    lastConvTimestamp = null;
    updateSendState();
    restoreDraftForCurrentView();

    try {
      const res = await fetch(`/api/chat/conversation?department=${encodeURIComponent(dept)}`);
      const messages = await res.json().catch(() => []);

      if (!Array.isArray(messages) || !messages.length) {
        renderSystem("No messages yet.");
        lastConvTimestamp = new Date().toISOString();
        armPolling();
        setConn("online");
        return;
      }

      messages.forEach(m => {
        renderMessage({
          id: m.id,
          mine: m.sender !== dept,
          message: m.message,
          timestamp: m.timestamp
        });
        lastConvTimestamp = m.timestamp;
      });

      scrollBottom(true);
      armPolling();
      setConn("online");

    } catch (e) {
      console.error("❌ Conversation load failed", e);
      renderSystem("Failed to load conversation.");
      armPolling();
      setConn("offline");
    }
  }

  /* -------------------------------------------------------
     SEND: Conversation
  ------------------------------------------------------- */
  async function sendToConversation(dept, text, bubbleElToUpdate = null) {
    clearFailedMarker(bubbleElToUpdate);

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: dept, message: text })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("❌ Send failed:", data.error || "Unknown error");
        markBubbleFailed(bubbleElToUpdate);
        setConn("offline");
        return false;
      }

      if (data?.message?.timestamp) lastConvTimestamp = data.message.timestamp;
      setConn("online");
      return true;

    } catch (e) {
      console.error("❌ Network send error", e);
      markBubbleFailed(bubbleElToUpdate);
      setConn("offline");
      return false;
    }
  }

  /* -------------------------------------------------------
     SEND: Inbox reply
  ------------------------------------------------------- */
  async function sendReplyFromInbox(targetDept, text, bubbleElToUpdate = null) {
    clearFailedMarker(bubbleElToUpdate);

    try {
      const res = await fetch("/api/chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply_to: targetDept, message: text })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("❌ Reply failed:", data.error || "Unknown error");
        markBubbleFailed(bubbleElToUpdate);
        setConn("offline");
        return false;
      }

      if (data?.message?.timestamp) lastInboxTimestamp = data.message.timestamp;

      // user is active in inbox -> seen
      if (!activeDept) markAllInboxRead();

      setConn("online");
      return true;

    } catch (e) {
      console.error("❌ Network reply error", e);
      markBubbleFailed(bubbleElToUpdate);
      setConn("offline");
      return false;
    }
  }

  /* -------------------------------------------------------
     SUBMIT (Optimistic) + anti-double-send
  ------------------------------------------------------- */
  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = chatInput.value.trim();
    if (!text) return;

    const mode = currentMode();
    const target = mode === "conversation" ? activeDept : replyTargetDept;
    if (!target) return;

    if (inFlightSend) return; // anti spam
    inFlightSend = true;
    updateSendState();

    const now = new Date().toISOString();
    const clientId = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    renderMessage({
      mine: true,
      message: text,
      timestamp: now,
      clientId
    });

    const optimisticBubble = chatArea.querySelector(`[data-client-id="${clientId}"]`);

    // clear input + draft
    chatInput.value = "";
    saveDraftForCurrentView();
    if (charCount) charCount.textContent = "0/500";
    updateSendState();
    scrollBottom(true);

    let ok = false;
    if (mode === "conversation") ok = await sendToConversation(target, text, optimisticBubble);
    else ok = await sendReplyFromInbox(target, text, optimisticBubble);

    if (!ok) markBubbleFailed(optimisticBubble);

    inFlightSend = false;
    updateSendState();
  });

  /* -------------------------------------------------------
     Enter to send (Shift+Enter newline)
  ------------------------------------------------------- */
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (sendBtn && !sendBtn.disabled) chatForm.requestSubmit();
    }
  });

  chatInput.addEventListener("input", updateSendState);

  /* -------------------------------------------------------
     POLLING
  ------------------------------------------------------- */
  async function pollConversation() {
    if (!activeDept || !lastConvTimestamp) return;

    try {
      const res = await fetch(
        `/api/chat/poll?department=${encodeURIComponent(activeDept)}&since=${encodeURIComponent(lastConvTimestamp)}`
      );
      const messages = await res.json().catch(() => []);
      if (!Array.isArray(messages) || !messages.length) return;

      const shouldStick = isNearBottom(140);

      messages.forEach(m => {
        renderMessage({
          id: m.id,
          mine: false,
          message: m.message,
          timestamp: m.timestamp
        });
        lastConvTimestamp = m.timestamp;
      });

      if (shouldStick) scrollBottom(true);
      setConn("online");

    } catch (e) {
      console.error("❌ Conversation polling error", e);
      setConn("offline");
    }
  }

  async function pollInbox() {
    if (activeDept) return;
    if (!lastInboxTimestamp) return;

    try {
      const res = await fetch(`/api/chat/poll-inbox?since=${encodeURIComponent(lastInboxTimestamp)}`);
      const messages = await res.json().catch(() => []);
      if (!Array.isArray(messages) || !messages.length) return;

      const modalOpen = !overlay.classList.contains("hidden");
      const shouldStick = isNearBottom(140);

      let newestTs = lastInboxTimestamp;

      messages.forEach(m => {
        newestTs = m.timestamp || newestTs;
        const mid = (m?.id != null) ? String(m.id) : null;

        if (modalOpen) {
          // render while open
          renderMessage({
            id: m.id,
            mine: false,
            message: m.message,
            timestamp: m.timestamp,
            label: normalizeDeptLabel(m.sender),
            meta: { from: m.sender }
          });
          if (!replyTargetDept && m.sender) setInboxReplyTarget(m.sender, normalizeDeptLabel(m.sender));
        } else {
          // modal closed => stable unread set
          if (mid) inboxUnreadIds.add(mid);
        }
      });

      lastInboxTimestamp = newestTs;

      if (modalOpen) {
        if (shouldStick) scrollBottom(true);
        markAllInboxRead(); // open = read
      } else {
        setUnreadCount(inboxUnreadIds.size);
      }

      updateSendState();
      setConn("online");

    } catch (e) {
      console.error("❌ Inbox polling error", e);
      setConn("offline");
    }
  }

  function armPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(() => {
      if (activeDept) pollConversation();
      else pollInbox();
    }, 1200);
  }

  /* -------------------------------------------------------
     EVENTS
  ------------------------------------------------------- */
  deptSelect.addEventListener("change", () => {
    saveDraftForCurrentView();

    const val = deptSelect.value;
    if (!val) {
      saveLastView("");
      loadInbox({ markReadOnLoad: true, forceReload: true });
    } else {
      saveLastView(val);
      loadConversation(val, { forceReload: true });
    }

    updateSendState();
  });

  if (inboxBtn) {
    inboxBtn.addEventListener("click", () => {
      saveDraftForCurrentView();
      deptSelect.value = "";
      saveLastView("");
      loadInbox({ markReadOnLoad: true, forceReload: true });
      updateSendState();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {

      // INBOX clear (view only)
      if (!activeDept) {
        clearChatArea();
        resetHistoryRenderState();
        renderSystem("Inbox cleared (view only).");

        lastInboxTimestamp = new Date().toISOString();
        saveSeenInboxTs(lastInboxTimestamp);

        inboxUnreadIds.clear();
        setUnreadCount(0, { silentBanner: true });
        hideChatAlertBanner();

        armPolling();
        return;
      }

      // Conversation clear
      if (!confirm("Clear this conversation permanently?")) return;

      try {
        const res = await fetch("/api/chat/clear", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ department: activeDept })
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Clear failed");

        lastConvTimestamp = null;
        renderSystem("Conversation cleared.");
        armPolling();

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

  // initial inbox load (same behavior as old v3.3: it renders history immediately)
  // but we now also compute unread set stably.
  loadInbox({ markReadOnLoad: false, forceReload: true });

  updateSendState();
  armPolling();

  // Start with modal closed, floating visible
  closeChatModal();
  showFloatingButton(true);

});