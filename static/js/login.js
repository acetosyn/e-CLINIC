// ============================================================
// e-Clinic Login Script (v3) — Real Flask API Integration
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const message = document.getElementById("loginMessage");
  const passwordInput = document.getElementById("password");
  const togglePassword = document.getElementById("togglePassword");

  // 👁️ Toggle password visibility
  togglePassword.addEventListener("click", () => {
    passwordInput.type = passwordInput.type === "password" ? "text" : "password";
  });

  // 🚀 Submit login to backend
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const role = form.role.value.trim();
    const username = form.username.value.trim();
    const password = form.password.value.trim();

    if (!role || !username || !password) {
      showMessage("Please fill in all fields.", "red");
      return;
    }

    try {
      const response = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username, password }),
      });

      const result = await response.json();

      if (result.success) {
        showMessage(`${result.message} Redirecting...`, "green");
        setTimeout(() => {
          window.location.href = "/home";
        }, 1000);
      } else {
        showMessage(result.message || "Invalid login credentials.", "red");
      }
    } catch (error) {
      console.error("Login error:", error);
      showMessage("Server error. Please try again later.", "red");
    }
  });

  // 🖋️ Typewriter effect (UI polish)
  const el = document.getElementById("typewriter");
  const lines = [
    "Select your department and log in to continue...",
    "Secure access to your e-Clinic dashboard...",
    "Stay connected to your Epiconsult team."
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

  // Helper function for consistent message display
  function showMessage(text, color) {
    message.textContent = text;
    message.style.color = color;
    message.style.fontWeight = "600";
    message.style.textAlign = "center";
  }
});
