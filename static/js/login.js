// ============================================================
// e-Clinic Login Script (v7) — Perfect Loader Edition
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("loginMessage");
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");

  const loginBtn = document.querySelector(".btn-login");
  const loginText = loginBtn.querySelector(".btn-text");
  const loginLoader = loginBtn.querySelector(".btn-loader");

  // Hide error message initially
  if (message) message.style.display = "none";

  // 👁️ Toggle password visibility
  togglePassword.addEventListener("click", () => {
    passwordInput.type =
      passwordInput.type === "password" ? "text" : "password";
  });

  // ------------------------------------------------------------
  // LOGIN SUBMISSION
  // ------------------------------------------------------------
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const role = form.role.value.trim();
    const username = form.username.value.trim();
    const password = form.password.value.trim();

    if (!role || !username || !password) {
      showError("Please fill in all fields.");
      return;
    }

    try {
      startLoadingAnimation();

      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username, password }),
      });

      const result = await response.json();

      if (result.success) {
        // Keep spinner running until redirect
        window.location.href = "/home";
      } else {
        stopLoadingAnimation();
        showError(result.message || "Invalid login credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      stopLoadingAnimation();
      showError("Server error. Please try again later.");
    }
  });

  // ------------------------------------------------------------
  // LOADING ANIMATION FUNCTIONS
  // ------------------------------------------------------------
  function startLoadingAnimation() {
    loginBtn.classList.add("loading");
    loginBtn.disabled = true;
    loginText.textContent = "Authenticating…";
  }

  function stopLoadingAnimation() {
    loginBtn.classList.remove("loading");
    loginBtn.disabled = false;
    loginText.textContent = "Login";
  }

  // ------------------------------------------------------------
  // ERROR DISPLAY
  // ------------------------------------------------------------
  function showError(text) {
    if (!message) return;
    message.style.display = "block";
    message.textContent = text;
    message.style.color = "red";
    message.style.fontWeight = "600";
  }

  // ------------------------------------------------------------
  // TYPEWRITER EFFECT
  // ------------------------------------------------------------
  const el = document.getElementById("typewriter");
  const lines = [
    "Select your department and log in to continue...",
    "Secure access to your e-Clinic dashboard...",
    "Stay connected to your Epiconsult team.",
  ];

  let i = 0, j = 0, deleting = false;

  function type() {
    const text = lines[i];
    el.textContent = text.substring(0, j);

    if (!deleting) {
      j++;
      if (j > text.length) {
        deleting = true;
        setTimeout(type, 1200);
        return;
      }
    } else {
      j--;
      if (j === 0) {
        deleting = false;
        i = (i + 1) % lines.length;
      }
    }

    setTimeout(type, deleting ? 45 : 80);
  }
  type();
});
