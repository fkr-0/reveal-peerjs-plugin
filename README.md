# RevealPeerJS

> Real-time peer collaboration plugin for Reveal.js presentations

[![npm](https://img.shields.io/npm/v/reveal-peerjs)](https://www.npmjs.com/package/reveal-peerjs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Transform any Reveal.js slideshow into an interactive, collaborative experience. RevealPeerJS connects all viewers through a shared lobby where they can chat, respond to polls, and play games—all without a backend server.

Documentation + showcase page: `https://reveal-peerjs.fkr.dev/`

## ✨ Features

### 🎛️ Lobby & Chat
- **Auto-discovery** — Users connecting to the same URL automatically join the same lobby
- **User list** — See all connected participants with custom colors
- **Public chat** — Broadcast messages to the entire lobby
- **Private messages** — Send direct messages to specific users

### 🎮 Hub Controls (First Visitor)
The first visitor becomes the **Hub** with special powers:
- **Jump All** — Instantly navigate all viewers to your current slide
- **Follow Mode** — Continuously sync your slide position to all viewers
- **Live Polls** — Create timed single- or multiple-choice polls with configurable duration and result sharing
- **Arena Launch** — Start a multiplayer game for all lobby members

### 🕹️ Mini-Games
- **Pong** — Challenge any user to a classic 1v1 Pong match
- **Arena** — Top-down shooter where all lobby members compete

### ⚙️ Settings
- Customize your **username** and **color**
- **Dark mode** — Force dark styling on presentations
- **High contrast** — Enhanced accessibility
- **Offline mode** — Temporarily disconnect from the lobby

## 🚀 Installation

### npm

```bash
npm install reveal-peerjs
```

### CDN

```html
<script src="https://cdn.jsdelivr.net/npm/reveal-peerjs@latest/dist/reveal-peerjs.js"></script>
```

### Direct Download

Download `dist/reveal-peerjs.js` and include it in your project.

## 📖 Usage

### Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/theme/black.css">
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <section>Your slides here</section>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
  <script src="dist/reveal-peerjs.js"></script>
  <script>
    Reveal.initialize({
      plugins: [RevealPeerJS]
    });
  </script>
</body>
</html>
```

### ES Modules

```javascript
import Reveal from 'reveal.js';
import RevealPeerJS from 'reveal-peerjs';

Reveal.initialize({
  plugins: [RevealPeerJS]
});
```

### With Options

```javascript
Reveal.initialize({
  hash: true,
  transition: 'slide',
  plugins: [RevealPeerJS]
});
```

## 🏗️ How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Same Presentation URL                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Visitor 1 (HUB)        Visitor 2         Visitor 3         │
│       ●                    ●                  ●             │
│       │                    │                  │             │
│       └────────────────────┼──────────────────┘             │
│                            │                                │
│                    ┌───────▼────────┐                       │
│                    │   PeerJS Star  │                       │
│                    │   Topology     │                       │
│                    └───────┬────────┘                       │
│                            │                                │
│                     Hub relays messages                     │
│                     between all peers                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

1. **Lobby ID** is derived from the page URL
2. First visitor becomes the **Hub** and creates a PeerJS peer
3. Subsequent visitors **connect to the Hub**
4. Hub **routes and validates messages** between all participants
5. Visitors accept authoritative poll and game state **only from the Hub connection**

### Hub-authoritative state model

- Every authoritative poll, Pong, and Arena message carries a protocol version plus a Hub identity, Hub epoch, and monotonic sequence number.
- Polls, Pong matches, and Arena rounds have explicit session IDs; stale messages from an older session are ignored.
- Peer identity is derived from the PeerJS connection. Client-supplied sender IDs, usernames, colors, and Arena ownership fields are never trusted by the Hub.
- Arena runs as a Hub-authoritative simulation. Visitors send bounded movement and shoot commands, then reconcile all local state from Hub snapshots.
- Pong uses the challenger as the match simulation authority, but every invite, response, input, snapshot, and terminal event is validated and routed through the Hub.

## 🎯 Features Deep Dive

### Polls

1. Hub clicks the orange **Hub icon** → "Launch Poll"
2. Enter question and 2-8 answer options
3. All viewers see a vote modal with the configured countdown and choice mode
4. Results display with animated bar charts

### Pong

1. Right-click any user in the lobby panel
2. Select **"Challenge to Pong"**
3. Semi-transparent overlay appears on both screens
4. Challenger on **left**, opponent on **right**
5. Mouse/finger controls paddle movement
6. First to **10 points** wins

### Arena Game

1. Hub clicks **"Launch Arena"**
2. All players join a shared 2D map
3. **H/J/K/L** to move, **Mouse** to aim, **Space** to fire
4. Hit once → half-filled circle, faster movement
5. Hit twice → eliminated
6. Last player standing wins!

## 🔧 Development

### Clone & Install

```bash
git clone https://github.com/yourusername/reveal-peerjs-plugin.git
cd reveal-peerjs-plugin
pnpm install
```

### Available Scripts

```bash
# Build the plugin for production
pnpm build

# Watch mode - rebuild on file changes
pnpm dev

# Dev server - watch + serve example at localhost:8080
pnpm dev-server

# Preview - build once and serve example
pnpm preview

# Run e2e tests
pnpm test:e2e

# Run e2e tests in UI mode
pnpm test:e2e:ui

# Run e2e tests in headed mode
pnpm test:e2e:headed
```

### Project Structure

```
reveal-peerjs-plugin/
├── src/
│   ├── index.js           # Main plugin entry point
│   ├── networking.js      # PeerJS lobby management
│   ├── protocol.js        # Message protocol definitions
│   ├── settings.js        # Settings persistence
│   ├── styles.js          # CSS injection
│   ├── icons.js           # SVG icons
│   ├── lobby-panel.js     # Lobby UI component
│   ├── settings-modal.js  # Settings dialog
│   ├── hub-menu.js        # Hub controls menu
│   ├── pong.js            # Pong mini-game
│   └── arena-game.js      # Arena shooter game
├── example/
│   └── index.html         # Demo presentation
├── dist/                  # Built output (generated)
├── scripts/
│   └── dev-server.js      # Dev server helper
├── vite.config.js         # Vite configuration
└── package.json
```

## 🧪 Testing

The project includes comprehensive end-to-end tests using [Playwright](https://playwright.dev/).

### Running Tests

```bash
# Install test dependencies
pnpm install

# Run all tests
pnpm test:e2e

# Run tests in interactive UI mode
pnpm test:e2e:ui

# Run tests in headed mode (show browser windows)
pnpm test:e2e:headed
```

### Test Coverage

- **Plugin Initialization** - Toolbar visibility, z-index, connection status
- **Lobby Panel** - Open/close, user list, chat messages
- **Settings Modal** - Username, color, toggles
- **Multiplayer** - Hub/visitor roles, multi-user lobby, chat propagation
- **Hub Controls** - Menu navigation, poll launching
- **Hub Authority** - Connection-bound identity, epoch/sequence ordering, stale-state rejection, and session isolation
- **Games** - Pong relay lifecycle, Arena reconciliation, bounded commands, disconnect/leave cleanup, and swept collision detection
- **Responsive Design** - Mobile, tablet, desktop viewports
- **Keyboard Navigation** - Tab focus, Escape to close

### Building

The plugin is built using [Vite](https://vitejs.dev/):

- **UMD format** (`dist/reveal-peerjs.js`) — For script tags
- **ES module format** (`dist/reveal-peerjs.es.js`) — For bundlers
- Source maps included

## 🌐 Browser Support

RevealPeerJS relies on [PeerJS](https://peerjs.com/), which requires:

- Modern browser with **WebRTC support**
- **ES2020+** JavaScript support

Tested on:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 📝 API Reference

### Plugin Initialization

```javascript
const RevealPeerJS = () => ({
  id: 'peerjs',
  
  init(deck) {
    // Plugin initialization
    // Returns object with destroy() method
  }
});
```

### Events

The plugin emits internal events via `LobbyNetwork`:

```javascript
network.on('connected', ({ isHub, user }) => { ... });
network.on('user-list', () => { ... });
network.on('chat', (msg) => { ... });
network.on('jump-slide', (payload) => { ... });
```

## 🤝 Contributing

Contributions welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

MIT © [Your Name]

## 🙏 Acknowledgments

- [Reveal.js](https://revealjs.com/) — The presentation framework
- [PeerJS](https://peerjs.com/) — WebRTC wrapper for peer-to-peer connections

## 🔗 Links

- [npm Package](https://www.npmjs.com/package/reveal-peerjs)
- [GitHub Repository](https://github.com/yourusername/reveal-peerjs-plugin)
- [Live Demo](https://yourusername.github.io/reveal-peerjs-plugin/example/)
- [Issue Tracker](https://github.com/yourusername/reveal-peerjs-plugin/issues)
