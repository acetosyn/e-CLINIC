# e-Clinic Notification System

This module adds a modern, Windows-style notification center to the **Epiconsult e-Clinic Dashboard**.  
It provides real-time alerts, smooth animations, and an interactive sidebar panel.

## ✨ Features
- 🔔 **Slide-in Notification Panel** — appears from the right with blur overlay.  
- 🧭 **Clickable Notifications** — each message can open a link or modal.  
- 🧾 **Scrollable List** — view multiple messages without overflow.  
- ❌ **Close Button & Overlay** — dismiss easily with smooth transitions.  
- 🌓 **Dark Mode Compatible** — automatically adapts to the current theme.  

## 🧩 Integration
1. **Add the CSS block** for `.notif-slide-panel`, `.notif-overlay`, and related classes  
   (found in your `main.css` update).  
2. **Include the JavaScript section** inside your `main.js` file —  
   look for the block titled:  
   `/* WINDOWS-STYLE NOTIFICATION PANEL (Interactive & Scrollable) */`
3. Ensure a trigger element exists in your header:
   ```html
   <button id="notifBtn"><i class="fa-solid fa-bell"></i></button>
