// static/js/login.js
document.addEventListener("DOMContentLoaded", () => {
  // ---------------------------
  // SPINNER CSS (auto-inject)
  // ---------------------------
  (function injectSpinnerCSS() {
    const id = "eu_login_spinner_css";
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .btn-spinner{
        width:16px;height:16px;
        border-radius:50%;
        border:2px solid rgba(255,255,255,0.45);
        border-top-color: rgba(255,255,255,1);
        display:none;
        animation: euSpin 0.75s linear infinite;
      }
      .loading .btn-spinner{ display:inline-block; }
      .loading { opacity:.95; }
      @keyframes euSpin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  })();

  // ---------------------------
  // HELPERS
  // ---------------------------
  async function safeJson(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: text || "Server error." };
    }
  }

function showToast(type, msg) {
  const toastSuccess = document.getElementById("toastSuccess");
  const toastError = document.getElementById("toastError");
  const toastErrorText = document.getElementById("toastErrorText");
  const loginMessage = document.getElementById("loginMessage");

  // Helper to force-show any toast regardless of CSS
  function forceShow(el) {
    if (!el) return;
    el.classList.add("is-show");

    // Force visibility even if CSS is wrong
    el.style.display = "flex";
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
    el.style.pointerEvents = "auto";
    el.style.zIndex = "999999";
  }

  function forceHide(el) {
    if (!el) return;
    el.classList.remove("is-show");

    // Hide after a small delay (so animation can happen if CSS exists)
    setTimeout(() => {
      el.style.display = "";
      el.style.opacity = "";
      el.style.transform = "";
      el.style.pointerEvents = "";
      el.style.zIndex = "";
    }, 200);
  }

  // Optional inline message fallback (inside the form)
  function inline(msgText, isError = true) {
    if (!loginMessage) return;
    loginMessage.textContent = msgText || "";
    loginMessage.style.display = msgText ? "block" : "none";
    loginMessage.style.marginTop = "10px";
    loginMessage.style.fontWeight = "700";
    loginMessage.style.padding = "10px 12px";
    loginMessage.style.borderRadius = "10px";

    if (isError) {
      loginMessage.style.color = "#b91c1c";
      loginMessage.style.background = "rgba(225, 29, 72, 0.12)";
      loginMessage.style.border = "1px solid rgba(225, 29, 72, 0.35)";
    } else {
      loginMessage.style.color = "#065f46";
      loginMessage.style.background = "rgba(16, 185, 129, 0.12)";
      loginMessage.style.border = "1px solid rgba(16, 185, 129, 0.35)";
    }

    clearTimeout(window.__loginInlineTimer);
    window.__loginInlineTimer = setTimeout(() => {
      loginMessage.style.display = "none";
    }, 4000);
  }

  // --- SHOW SUCCESS ---
  if (type === "success") {
    // hide error if visible
    if (toastError) forceHide(toastError);

    if (toastSuccess) {
      forceShow(toastSuccess);
      setTimeout(() => forceHide(toastSuccess), 2500);
    } else {
      inline("Login successful. Redirecting…", false);
    }
    return;
  }

  // --- SHOW ERROR ---
  const message = msg || "Invalid username or password. Try again.";

  // hide success if visible
  if (toastSuccess) forceHide(toastSuccess);

  if (toastError) {
    if (toastErrorText) toastErrorText.textContent = message;
    forceShow(toastError);
    setTimeout(() => forceHide(toastError), 3500);
  } else {
    inline(message, true);
  }
}

  // Toast close buttons
  document.querySelectorAll("[data-toast-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("toastSuccess")?.classList.remove("is-show");
      document.getElementById("toastError")?.classList.remove("is-show");
    });
  });

  // Ensure a button has spinner + text structure
  function ensureSpinnerMarkup(btn, defaultText = "Login") {
    if (!btn) return;

    let spinner = btn.querySelector(".btn-spinner");
    let textEl = btn.querySelector(".btn-text");

    if (!spinner || !textEl) {
      const originalText = (btn.textContent || "").trim() || defaultText;
      btn.innerHTML = `
        <span class="btn-spinner" aria-hidden="true"></span>
        <span class="btn-text">${originalText}</span>
      `;
    }

    // make it look nice even if CSS not applied
    btn.style.display = btn.style.display || "inline-flex";
    btn.style.alignItems = "center";
    btn.style.justifyContent = "center";
    btn.style.gap = "10px";
  }

  function setButtonLoading(btn, isLoading, loadingText, normalText) {
    if (!btn) return;

    ensureSpinnerMarkup(btn, normalText);
    const textEl = btn.querySelector(".btn-text");

    btn.disabled = !!isLoading;
    btn.classList.toggle("loading", !!isLoading);

    if (textEl) textEl.textContent = isLoading ? loadingText : normalText;
  }

  // ---------------------------
  // LOGIN
  // ---------------------------
  const form = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");

  // Ensure spinner exists even if HTML doesn't include it
  ensureSpinnerMarkup(loginBtn, "Login");

  const passwordInput = document.getElementById("password");
  const togglePasswordBtn = document.querySelector("[data-toggle-password]");
  const capsHint = document.getElementById("capsLockHint");

  // Toggle password visibility
  if (togglePasswordBtn && passwordInput) {
    togglePasswordBtn.addEventListener("click", () => {
      passwordInput.type = passwordInput.type === "password" ? "text" : "password";
    });
  }

  // Caps lock hint
  if (passwordInput && capsHint) {
    capsHint.style.display = "none";
    passwordInput.addEventListener("keyup", (e) => {
      const caps = e.getModifierState && e.getModifierState("CapsLock");
      capsHint.style.display = caps ? "inline-flex" : "none";
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const username = (form.username?.value || "").trim();
      const password = (form.password?.value || "").trim();

      if (!username || !password) {
        showToast("error", "Username and password are required.");
        return;
      }

      try {
        setButtonLoading(loginBtn, true, "Authenticating…", "Login");

        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const result = await safeJson(res);

        if (result.success) {
          showToast("success");
          window.location.href = result.redirect_url || "/home";
          return;
        }

        setButtonLoading(loginBtn, false, "Authenticating…", "Login");
        showToast("error", result.message || "Invalid login credentials.");
      } catch (err) {
        console.error(err);
        setButtonLoading(loginBtn, false, "Authenticating…", "Login");
        showToast("error", "Server error. Please try again.");
      }
    });
  }

  // ---------------------------
  // ADMIN MODAL (PASSKEY)
  // ---------------------------
  const openAdminBtn = document.querySelector("[data-open-admin]");
  const modal = document.getElementById("adminModal");
  const closeBtns = document.querySelectorAll("[data-close-admin]");
  const continueBtn = document.querySelector("[data-admin-continue]");
  const adminPassInput = document.getElementById("adminPasskey");
  const adminError = document.getElementById("adminError");

  // Optional: spinner for continue button too
  ensureSpinnerMarkup(continueBtn, "Continue");

  function openModal() {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "false");
    modal.classList.add("is-open");
    if (adminError) adminError.style.display = "none";
    if (adminPassInput) {
      adminPassInput.value = "";
      adminPassInput.focus();
    }
  }

  function closeModal() {
    if (!modal) return;
    modal.setAttribute("aria-hidden", "true");
    modal.classList.remove("is-open");
    setButtonLoading(continueBtn, false, "Checking…", "Continue");
  }

  openAdminBtn?.addEventListener("click", openModal);
  closeBtns.forEach((b) => b.addEventListener("click", closeModal));

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) closeModal();
  });

  async function submitAdminPasskey() {
    const passkey = (adminPassInput?.value || "").trim();

    if (!passkey) {
      if (adminError) {
        adminError.textContent = "Passkey is required.";
        adminError.style.display = "block";
      }
      return;
    }

    try {
      setButtonLoading(continueBtn, true, "Checking…", "Continue");

      const res = await fetch("/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ passkey }),
      });

      const result = await safeJson(res);

      if (result.success) {
        window.location.href = result.redirect_url || "/admin/users";
        return;
      }

      setButtonLoading(continueBtn, false, "Checking…", "Continue");
      if (adminError) {
        adminError.textContent = result.message || "Incorrect passkey.";
        adminError.style.display = "block";
      }
    } catch (err) {
      console.error(err);
      setButtonLoading(continueBtn, false, "Checking…", "Continue");
      if (adminError) {
        adminError.textContent = "Network/server error.";
        adminError.style.display = "block";
      }
    }
  }

  continueBtn?.addEventListener("click", submitAdminPasskey);
  adminPassInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitAdminPasskey();
  });
});