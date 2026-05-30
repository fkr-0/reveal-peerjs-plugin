# RevealPeerJS Docs

This page is the practical companion to the main README, focused on quick setup and demo access.

## Enhanced README

- Main README: [`README.md`](../README.md)

## Usage Instructions

### npm install

```bash
npm install reveal-peerjs
```

```js
import Reveal from 'reveal.js';
import RevealPeerJS from 'reveal-peerjs';

Reveal.initialize({
  hash: true,
  plugins: [RevealPeerJS]
});
```

### Script include

```html
<script src="https://cdn.jsdelivr.net/npm/reveal-peerjs@latest/dist/reveal-peerjs.js"></script>
<script>
  Reveal.initialize({ plugins: [RevealPeerJS] });
</script>
```

## Example And Showcase

- Local example deck: [`example/index.html`](../example/index.html)
- Run locally:

```bash
npm install
npm run dev-server
```

Then open `http://localhost:8080/example/` in two windows to see lobby, chat, hub controls, and games in action.
