# Bidirectional Rich Text Sync Across Iframes

A high-performance, real-time rich text editor synchronization system that communicates bidirectionally across isolated iframe contexts. Built as a technical assessment for the **Engineering Intern** role at **EduChunks**.

---

## 🚀 Key Features

This implementation meets all core requirements and delivers on several bonus features:

### 🌟 Core Requirements (Completed)
- **Isolated Editor Frames**: Two distinct iframe instances rendering a rich text editor UI.
- **Rich Formatting Toolbar**: Fully functional buttons for **Bold**, *Italic*, and ~~Strikethrough~~.
- **Bidirectional Sync**: Real-time formatting sync works seamlessly from Frame A ➔ Frame B and Frame B ➔ Frame A.
- **postMessage Relay Broker**: The host page acts as a secure message broker, routing events between frames.
- **Infinite Loop Protection**: Implements a syncing transaction lock flag that prevents receiving frames from re-broadcasting events back to the broker.

### ⭐ Nice-to-Haves & Bonus Challenges (Completed)
- **Origin Validation**: Message origin validation logic with `file://` fallback capabilities for easy offline execution.
- **Active Toolbar Button Reflection**: Button highlight states align dynamically with active selection or cursor position.
- **Interactive Message Broker Visualizer**: A visual schematic representing Editor A Node ➔ Host Broker ➔ Editor B Node. Sync actions prompt virtual glowing data packets to travel along connecting paths, triggering host broker pulses and target node flashes.
- **Micro-Interaction Click Particles**: Physics-mode particle stars shoot out from toolbar buttons when clicked, with colors customized to reflect the formatting theme.
- **Sync Latency Badges**: Real-time comparison metrics display a temporary `Xms sync` blue badge on receiving editors to document transmission delay.
- **Typing WPM Calculator**: A real-time WPM calculator displays active typing speeds inside editors, fading away gracefully when input ceases.
- **Cyber-punk log filters**: Filter stream tabs (`[All]`, `[Format]`, `[Typing]`, `[History]`) inside the terminal log to isolate specific transaction types.
- **Cursor Focus & Caret Preservation**: Computes and restores character caret offsets recursively in text nodes, preventing cursor resets.
- **Shared Undo/Redo Engine**: Custom block-state logs keep editors' history stacks aligned. Pressing `Ctrl+Z` in one frame triggers reverse-history syncing in both.
- **Real-Time Log Terminal**: A simulated OS terminal with functional window controls: **Red Dot** closes the terminal (showing a restore button), **Yellow Dot** minimizes/collapses it, and **Green Dot** maximizes it into a fullscreen HUD, alongside expandable HTML previews.
- **Global Theme Engine Switcher**: Toggles between Space Dark, Matrix Green, and Cyberpunk Neon themes on the host header, instantly propagating theme classes to both nested iframe editors.
- **Typing Collaboration Indicators**: When one editor starts typing, the peer editor's status dot blinks and displays e.g., "Editor A is typing..." to prevent concurrent collision locks.
- **Throttled Input Sync Buffering**: Limits message transmission to 60ms intervals during rapid typing, optimizing UI rendering and browser thread memory usage.

---

## 📐 Architecture Flow

```
+---------------------------------------------------------------------------------+
|                                    HOST PAGE                                    |
|  +---------------------------------------------------------------------------+  |
|  |                         postMessage Message Broker                        |  |
|  +-------------------------------------+-------------------------------------+  |
|                                        |                                        |
|                     (Event Relay)      |      (Event Relay)                     |
|            +---------------------------+---------------------------+            |
|            |                                                       |            |
|            v                                                       v            |
|  +-------------------+                                   +-------------------+  |
|  |     FRAME A       |                                   |     FRAME B       |  |
|  |  +-------------+  |                                   |  +-------------+  |  |
|  |  | Rich Editor |  |                                   |  | Rich Editor |  |  |
|  |  +-------------+  |                                   |  +-------------+  |  |
|  +-------------------+                                   +-------------------+  |
+---------------------------------------------------------------------------------+
```

---

## 🛠️ Tech Stack & Styling

- **Core**: Vanilla HTML5, Vanilla JavaScript.
- **Styling**: Premium Custom CSS.
- **Aesthetic Theme**: Modern glassmorphism dark mode with vibrant neon accents (indigo, purple, emerald, pink), flowing radial gradients, and the **Inter** font family.
- **Development Tooling**: Served with **Vite** for local development.

---

## 📂 File Structure

```
├── index.html       # Host page dashboard
├── styles.css       # Styling for the host dashboard (glassmorphic terminal, logs, layout)
├── host.js          # Host postMessage relay logic and log terminal UI
├── editor.html      # Text editor HTML loaded by the iframes
├── editor.css       # Styling for the editor toolbar and editable field
├── editor.js        # Editor syncing logic, cursor tracking, and undo/redo stacks
├── package.json     # Node configurations and Vite server details
└── README.md        # Documentation
```

---

## 🚦 How to Run the Project

### Option 1: Double-Click (Zero Setup)
Simply open the `index.html` file directly in any modern web browser (Double-click or drag-and-drop).
*Note: Origin validation checks contain fallbacks for the `file://` protocol so it runs seamlessly out-of-the-box.*

### Option 2: Local Development Server (Recommended)
To run in a structured HTTP/HTTPS local environment:
1. Ensure [Node.js](https://nodejs.org/) is installed.
2. Open your terminal in the project directory and run:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local URL (usually `http://localhost:5173`) in your browser.


