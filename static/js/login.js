// static/js/login.js
document.addEventListener("DOMContentLoaded", () => {
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

    if (type === "success" && toastSuccess) {
      toastSuccess.classList.add("is-show");
      setTimeout(() => toastSuccess.classList.remove("is-show"), 2500);
    }

    if (type === "error" && toastError) {
      if (toastErrorText && msg) toastErrorText.textContent = msg;
      toastError.classList.add("is-show");
      setTimeout(() => toastError.classList.remove("is-show"), 3500);
    }
  }

  // Toast close buttons
  document.querySelectorAll("[data-toast-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.getElementById("toastSuccess")?.classList.remove("is-show");
      document.getElementById("toastError")?.classList.remove("is-show");
    });
  });

  // ---------------------------
  // LOGIN
  // ---------------------------
  const form = document.getElementById("loginForm");
  const loginBtn = document.getElementById("loginBtn");
  const loginBtnText = loginBtn?.querySelector(".btn-text");
  const spinner = loginBtn?.querySelector(".btn-spinner");

  const passwordInput = document.getElementById("password");
  const togglePasswordBtn = document.querySelector("[data-toggle-password]");
  const capsHint = document.getElementById("capsLockHint");

  function setLoading(isLoading) {
    if (!loginBtn) return;
    loginBtn.disabled = isLoading;
    loginBtn.classList.toggle("loading", isLoading);
    if (spinner) spinner.style.opacity = isLoading ? "1" : "0";
    if (loginBtnText) loginBtnText.textContent = isLoading ? "Authenticating…" : "Login";
  }

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

  // Submit login (IMPORTANT: goes to /login)
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
        setLoading(true);

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

        setLoading(false);
        showToast("error", result.message || "Invalid login credentials.");
      } catch (err) {
        console.error(err);
        setLoading(false);
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
  }

  openAdminBtn?.addEventListener("click", openModal);
  closeBtns.forEach((b) => b.addEventListener("click", closeModal));

  // ESC closes modal
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

      if (adminError) {
        adminError.textContent = result.message || "Incorrect passkey.";
        adminError.style.display = "block";
      }
    } catch (err) {
      console.error(err);
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
