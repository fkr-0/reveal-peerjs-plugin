# Debugging Toolbar Visibility

If the toolbar is not visible, follow these steps:

## Quick Verification

1. **Open browser DevTools** (F12) and go to Console tab
2. **Look for these messages:**
   ```
   [RevealPeerJS] Plugin initializing...
   [RevealPeerJS] Creating toolbar and appending to body...
   [RevealPeerJS] Toolbar appended. Visible: true
   ```

3. **Check Elements tab:**
   - Look for `<div class="rpjs-toolbar">` in the DOM
   - Check its computed styles (especially `display`, `position`, `z-index`)

## Common Issues

### Issue 1: Script not loading
**Symptoms:** No console logs, `RevealPeerJS` is undefined

**Solution:** Check that the script tag points to the correct path:
```html
<script src="/dist/reveal-peerjs.js"></script>
```

When using the dev server, the path should be `/dist/reveal-peerjs.js` (absolute path from server root).

### Issue 2: Plugin not registered
**Symptoms:** Console logs show "Plugin initializing" but toolbar not created

**Solution:** Check that the plugin is in the `plugins` array:
```javascript
Reveal.initialize({
  plugins: [RevealPeerJS]  // Make sure it's here!
});
```

### Issue 3: Toolbar hidden by CSS
**Symptoms:** Toolbar exists in DOM but not visible

**Solution:** Check computed styles:
- `position: fixed`
- `bottom: 12px`
- `left: 12px`
- `z-index: 9999`
- `display: flex`
- `visibility: visible`
- `opacity: 1`

### Issue 4: Reveal.js version incompatibility
**Symptoms:** Plugin init never called

**Solution:** Make sure you're using Reveal.js 5.x:
```html
<script src="https://cdn.jsdelivr.net/npm/reveal.js@5.1.0/dist/reveal.js"></script>
```

## Testing Without Reveal.js

Use the test-loading.html file to verify the plugin loads correctly:

```bash
# Start dev server
npm run dev-server

# Open in browser
http://localhost:8080/test-loading.html
```

This will show you:
- Whether RevealPeerJS is available globally
- Whether the plugin function structure is correct
- Whether styles are injected

## Manual Style Check

In the browser console, run:
```javascript
const toolbar = document.querySelector('.rpjs-toolbar');
if (!toolbar) {
  console.error('Toolbar not found in DOM!');
} else {
  const styles = window.getComputedStyle(toolbar);
  console.log('Toolbar styles:', {
    display: styles.display,
    position: styles.position,
    bottom: styles.bottom,
    left: styles.left,
    zIndex: styles.zIndex,
    visibility: styles.visibility,
    opacity: styles.opacity
  });
}
```

## Dev Server Issues

If the dev server has issues serving files:

1. **Check port 8080 is available:**
   ```bash
   lsof -i :8080  # macOS/Linux
   netstat -ano | findstr :8080  # Windows
   ```

2. **Restart the dev server:**
   ```bash
   # Kill existing process
   pkill -f "node scripts/dev-server"

   # Start fresh
   npm run dev-server
   ```

3. **Verify file structure:**
   ```
   /
   ├── dist/
   │   └── reveal-peerjs.js  ✓
   ├── example/
   │   └── index.html        ✓
   └── test-loading.html     ✓
   ```

## Still Not Working?

1. Check browser console for JavaScript errors
2. Check Network tab for failed script loads (404 errors)
3. Try in an incognito/private window (no extensions)
4. Clear browser cache and reload
