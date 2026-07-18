/**
 * Shared visual language, accessibility states, responsive rules, and design
 * tokens layered over the component structure in styles.js.
 */

export const UI_SYSTEM_STYLES = `
    :root {
      --rpjs-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --rpjs-surface: rgba(20, 22, 28, 0.96);
      --rpjs-surface-raised: rgba(30, 33, 41, 0.98);
      --rpjs-surface-interactive: rgba(255, 255, 255, 0.08);
      --rpjs-surface-hover: rgba(255, 255, 255, 0.14);
      --rpjs-border: rgba(255, 255, 255, 0.16);
      --rpjs-control-border: rgba(255, 255, 255, 0.36);
      --rpjs-border-subtle: rgba(255, 255, 255, 0.1);
      --rpjs-text: #f7f9fb;
      --rpjs-text-muted: #c4cbd3;
      --rpjs-text-subtle: #9fa8b3;
      --rpjs-primary: #69d2ff;
      --rpjs-primary-hover: #91dfff;
      --rpjs-primary-ink: #07141b;
      --rpjs-warning: #ffbd66;
      --rpjs-warning-ink: #201305;
      --rpjs-success: #79d98b;
      --rpjs-danger: #ff7b7b;
      --rpjs-focus: #8de3ff;
      --rpjs-radius-sm: 8px;
      --rpjs-radius-md: 12px;
      --rpjs-radius-lg: 16px;
      --rpjs-shadow: 0 16px 48px rgba(0, 0, 0, 0.48);
      --rpjs-control-height: 44px;
    }

    .rpjs-sr-only {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      padding: 0 !important;
      margin: -1px !important;
      overflow: hidden !important;
      clip: rect(0, 0, 0, 0) !important;
      white-space: nowrap !important;
      border: 0 !important;
    }

    /* ========== UI quality and consistency layer ========== */
    .rpjs-toolbar,
    .rpjs-lobby-panel,
    .rpjs-modal-overlay,
    .rpjs-hub-menu,
    .rpjs-context-menu,
    .rpjs-poll-vote-overlay,
    .rpjs-pong-overlay,
    .rpjs-arena-overlay {
      font-family: var(--rpjs-font);
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
      color-scheme: dark;
    }

    .rpjs-toolbar {
      bottom: max(12px, env(safe-area-inset-bottom)) !important;
      left: max(12px, env(safe-area-inset-left)) !important;
      gap: 6px;
      padding: 4px;
      border: 1px solid var(--rpjs-border-subtle);
      border-radius: 14px;
      background: rgba(12, 14, 18, 0.78);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.36);
      backdrop-filter: blur(14px) saturate(130%);
      -webkit-backdrop-filter: blur(14px) saturate(130%);
    }

    .rpjs-toolbar button {
      width: 44px !important;
      height: 44px !important;
      min-width: 44px !important;
      min-height: 44px !important;
      border: 1px solid transparent !important;
      border-radius: 10px;
      background: transparent !important;
      color: var(--rpjs-text-muted) !important;
      transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
    }

    .rpjs-toolbar button:hover {
      background: var(--rpjs-surface-hover) !important;
      color: var(--rpjs-text) !important;
      transform: translateY(-1px);
    }

    .rpjs-toolbar button:active {
      transform: translateY(0);
    }

    .rpjs-toolbar button.rpjs-active {
      background: rgba(105, 210, 255, 0.2) !important;
      border-color: rgba(105, 210, 255, 0.46) !important;
      color: var(--rpjs-primary) !important;
    }

    .rpjs-toolbar button.rpjs-hub-btn {
      background: rgba(255, 189, 102, 0.14) !important;
      color: var(--rpjs-warning) !important;
    }

    .rpjs-toolbar button.rpjs-hub-btn:hover,
    .rpjs-toolbar button.rpjs-hub-btn.rpjs-active {
      background: rgba(255, 189, 102, 0.24) !important;
      border-color: rgba(255, 189, 102, 0.48) !important;
    }

    .rpjs-toolbar button:focus-visible,
    .rpjs-lobby-panel button:focus-visible,
    .rpjs-lobby-panel input:focus-visible,
    .rpjs-modal button:focus-visible,
    .rpjs-modal input:focus-visible,
    .rpjs-modal select:focus-visible,
    .rpjs-hub-menu button:focus-visible,
    .rpjs-context-menu button:focus-visible,
    .rpjs-poll-vote-card button:focus-visible,
    .rpjs-pong-exit:focus-visible,
    .rpjs-arena-exit:focus-visible,
    .rpjs-arena-item-legend summary:focus-visible,
    .rpjs-arena-shoot-btn:focus-visible {
      outline: 3px solid var(--rpjs-focus);
      outline-offset: 2px;
      box-shadow: 0 0 0 1px #07141b;
    }

    .rpjs-lobby-panel,
    .rpjs-hub-menu,
    .rpjs-modal,
    .rpjs-poll-vote-card,
    .rpjs-context-menu {
      background: var(--rpjs-surface);
      border-color: var(--rpjs-border);
      box-shadow: var(--rpjs-shadow);
      color: var(--rpjs-text);
    }

    .rpjs-lobby-panel {
      bottom: calc(max(12px, env(safe-area-inset-bottom)) + 58px);
      left: max(12px, env(safe-area-inset-left));
      width: min(380px, calc(100vw - 24px));
      height: min(560px, calc(100vh - 94px));
      max-height: calc(100vh - 94px);
      border-radius: var(--rpjs-radius-lg);
      font-size: 14px;
    }

    .rpjs-lobby-header {
      min-height: 56px;
      padding: 6px 8px 6px 16px;
      border-bottom-color: var(--rpjs-border-subtle);
    }

    .rpjs-lobby-heading-group,
    .rpjs-lobby-header-actions,
    .rpjs-connection-status {
      display: flex;
      align-items: center;
    }

    .rpjs-lobby-heading-group {
      gap: 12px;
      min-width: 0;
    }

    .rpjs-lobby-heading-group h2,
    .rpjs-modal-title h2,
    .rpjs-hub-menu-title,
    .rpjs-poll-vote-question {
      margin: 0;
      color: var(--rpjs-text);
      font-family: inherit;
    }

    .rpjs-lobby-heading-group h2 {
      font-size: 15px;
      font-weight: 700;
    }

    .rpjs-connection-status {
      gap: 6px;
      color: var(--rpjs-text-subtle);
      font-size: 11px;
      font-weight: 500;
    }

    .rpjs-status-dot {
      margin: 0;
      animation: none;
      background: var(--rpjs-success);
      box-shadow: 0 0 0 2px rgba(121, 217, 139, 0.14);
    }

    .rpjs-status-dot.rpjs-connecting {
      background: var(--rpjs-warning);
      animation: rpjs-pulse 1.4s ease infinite;
    }

    .rpjs-status-dot.rpjs-offline {
      background: var(--rpjs-danger);
      box-shadow: 0 0 0 2px rgba(255, 123, 123, 0.14);
    }

    .rpjs-lobby-close,
    .rpjs-modal-close {
      width: 44px;
      height: 44px;
      padding: 0;
      border-radius: 10px;
      align-items: center;
      justify-content: center;
      color: var(--rpjs-text-muted);
    }

    .rpjs-lobby-close:hover,
    .rpjs-modal-close:hover {
      background: var(--rpjs-surface-hover);
      color: var(--rpjs-text);
    }

    .rpjs-section-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 14px 6px;
      color: var(--rpjs-text-subtle);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    .rpjs-section-count {
      min-width: 22px;
      padding: 2px 6px;
      border-radius: 999px;
      background: var(--rpjs-surface-interactive);
      color: var(--rpjs-text-muted);
      text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .rpjs-users-section {
      padding: 8px 0;
      border-bottom-color: var(--rpjs-border-subtle);
      max-height: 180px;
    }

    .rpjs-user-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 44px;
      align-items: stretch;
      margin: 1px 6px;
      border-radius: 10px;
    }

    .rpjs-user-row-self {
      grid-template-columns: minmax(0, 1fr);
    }

    .rpjs-user-item,
    .rpjs-user-actions {
      min-height: 44px;
      border: 0;
      background: transparent;
      color: var(--rpjs-text);
      font: inherit;
      cursor: pointer;
    }

    .rpjs-user-item {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      padding: 8px 8px;
      margin: 0;
      border-radius: 10px;
      text-align: left;
    }

    .rpjs-user-item:hover:not(:disabled),
    .rpjs-user-actions:hover {
      background: var(--rpjs-surface-hover);
    }

    .rpjs-user-item:disabled {
      cursor: default;
      opacity: 1;
    }

    .rpjs-user-actions {
      border-radius: 10px;
      color: var(--rpjs-text-subtle);
      letter-spacing: 0.08em;
    }

    .rpjs-user-name {
      color: var(--rpjs-text);
      font-size: 13px;
      font-weight: 550;
    }

    .rpjs-user-hub-tag {
      background: rgba(255, 189, 102, 0.16);
      color: var(--rpjs-warning);
    }

    .rpjs-user-self-tag {
      background: rgba(105, 210, 255, 0.14);
      color: var(--rpjs-primary);
    }

    .rpjs-chat-section {
      padding: 10px 12px;
      gap: 6px;
    }

    .rpjs-empty-state {
      margin: auto;
      max-width: 240px;
      padding: 20px;
      color: var(--rpjs-text-subtle);
      font-size: 13px;
      line-height: 1.5;
      text-align: center;
    }

    .rpjs-chat-msg {
      padding: 6px 8px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.45;
    }

    .rpjs-chat-identity-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      margin-right: 6px;
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.24);
      vertical-align: 1px;
    }

    .rpjs-chat-username {
      color: var(--rpjs-text);
    }

    .rpjs-chat-text {
      color: var(--rpjs-text-muted);
    }

    .rpjs-chat-private-label {
      color: #e4b3ee;
    }

    .rpjs-chat-system {
      color: var(--rpjs-text-subtle);
    }

    .rpjs-chat-input-area {
      gap: 8px;
      padding: 10px 12px max(10px, env(safe-area-inset-bottom));
      border-top-color: var(--rpjs-border-subtle);
    }

    .rpjs-chat-input,
    .rpjs-target-btn,
    .rpjs-send-btn,
    .rpjs-field-input,
    .rpjs-poll-question-input,
    .rpjs-poll-answer-input,
    .rpjs-poll-select {
      min-height: var(--rpjs-control-height);
      border: 1px solid var(--rpjs-control-border);
      background: var(--rpjs-surface-interactive);
      color: var(--rpjs-text);
    }

    .rpjs-chat-input,
    .rpjs-field-input,
    .rpjs-poll-question-input,
    .rpjs-poll-answer-input {
      padding: 10px 12px;
      border-radius: 10px;
      font-size: 14px;
    }

    .rpjs-chat-input::placeholder,
    .rpjs-field-input::placeholder,
    .rpjs-poll-question-input::placeholder,
    .rpjs-poll-answer-input::placeholder {
      color: #9099a5;
      opacity: 1;
    }

    .rpjs-target-btn {
      max-width: 120px;
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 12px;
    }

    .rpjs-send-btn {
      width: 44px;
      height: 44px;
      border-radius: 10px;
      background: var(--rpjs-primary);
      color: var(--rpjs-primary-ink);
    }

    .rpjs-send-btn:hover:not(:disabled) {
      background: var(--rpjs-primary-hover);
    }

    .rpjs-send-btn:disabled,
    .rpjs-save-btn:disabled,
    .rpjs-poll-publish-btn:disabled,
    .rpjs-poll-submit-vote:disabled {
      cursor: not-allowed;
      opacity: 0.42;
      filter: saturate(0.35);
    }

    .rpjs-target-dropdown-list {
      min-width: 210px;
      padding: 5px;
      border-color: var(--rpjs-border);
      border-radius: 12px;
      background: var(--rpjs-surface-raised);
    }

    .rpjs-target-dropdown-item {
      width: 100%;
      min-height: 44px;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--rpjs-text-muted);
      font: inherit;
      text-align: left;
    }

    .rpjs-target-dropdown-item:hover,
    .rpjs-target-dropdown-item[aria-checked="true"] {
      background: var(--rpjs-surface-hover);
      color: var(--rpjs-text);
    }

    .rpjs-modal-overlay,
    .rpjs-poll-vote-overlay {
      padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      box-sizing: border-box;
      background: rgba(5, 7, 10, 0.72);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }

    .rpjs-modal,
    .rpjs-poll-vote-card {
      width: min(440px, 100%);
      max-width: 100%;
      max-height: calc(100vh - 32px);
      padding: 24px;
      border-radius: var(--rpjs-radius-lg);
      box-sizing: border-box;
    }

    .rpjs-modal-title {
      min-height: 44px;
      margin-bottom: 18px;
    }

    .rpjs-modal-title h2 {
      font-size: 18px;
      font-weight: 720;
      line-height: 1.25;
    }

    .rpjs-modal-title-centered {
      justify-content: center;
      text-align: center;
    }

    .rpjs-field {
      margin-bottom: 18px;
    }

    .rpjs-field-label {
      color: var(--rpjs-text-muted);
      font-size: 12px;
      font-weight: 650;
      letter-spacing: 0.04em;
    }

    .rpjs-field-help,
    .rpjs-toggle-description {
      display: block;
      margin-top: 6px;
      color: var(--rpjs-text-subtle);
      font-size: 12px;
      line-height: 1.4;
    }

    .rpjs-field-error {
      min-height: 18px;
      margin: 4px 0 8px;
      color: #ffaaaa;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
    }

    .rpjs-character-preview {
      margin-top: 8px;
      padding: 10px 12px;
      border: 1px solid var(--rpjs-border-subtle);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--rpjs-text-muted);
      font-size: 12px;
      line-height: 1.5;
    }

    .rpjs-color-picker {
      width: 48px;
      height: 44px;
      border-color: var(--rpjs-border);
      border-radius: 10px;
    }

    .rpjs-toggle-row {
      gap: 16px;
      min-height: 52px;
      padding: 4px 0;
    }

    .rpjs-toggle-row > span:first-child {
      min-width: 0;
    }

    .rpjs-toggle-label {
      display: block;
      color: var(--rpjs-text);
      font-size: 14px;
      font-weight: 600;
    }

    .rpjs-toggle {
      position: relative;
      flex: 0 0 52px;
      width: 52px;
      height: 44px;
      min-width: 52px;
      min-height: 44px;
      background: transparent;
      border-radius: 12px;
    }

    .rpjs-toggle::before {
      content: '';
      position: absolute;
      top: 10px;
      left: 4px;
      width: 44px;
      height: 24px;
      border: 1px solid var(--rpjs-control-border);
      border-radius: 999px;
      background: #4a515c;
      transition: background-color 0.18s ease, border-color 0.18s ease;
    }

    .rpjs-toggle::after {
      top: 13px;
      left: 7px;
      width: 18px;
      height: 18px;
      transition: transform 0.18s ease;
    }

    .rpjs-toggle.rpjs-active {
      background: transparent;
    }

    .rpjs-toggle.rpjs-active::before {
      border-color: var(--rpjs-primary);
      background: var(--rpjs-primary);
    }

    .rpjs-toggle.rpjs-active::after {
      background: var(--rpjs-primary-ink);
      transform: translateX(20px);
    }

    .rpjs-save-btn,
    .rpjs-poll-publish-btn,
    .rpjs-poll-submit-vote,
    .rpjs-primary-btn,
    .rpjs-secondary-btn {
      min-height: 44px;
      padding: 10px 16px;
      border-radius: 10px;
      font: 650 14px/1 var(--rpjs-font);
    }

    .rpjs-save-btn,
    .rpjs-primary-btn {
      border: 1px solid transparent;
      background: var(--rpjs-primary);
      color: var(--rpjs-primary-ink);
    }

    .rpjs-save-btn:hover,
    .rpjs-primary-btn:hover {
      background: var(--rpjs-primary-hover);
    }

    .rpjs-secondary-btn {
      border: 1px solid var(--rpjs-border);
      background: var(--rpjs-surface-interactive);
      color: var(--rpjs-text);
    }

    .rpjs-secondary-btn:hover {
      background: var(--rpjs-surface-hover);
    }

    .rpjs-confirm-dialog {
      text-align: center;
    }

    .rpjs-confirm-message {
      margin: 0 0 22px;
      color: var(--rpjs-text-muted);
      font-size: 14px;
      line-height: 1.5;
    }

    .rpjs-confirm-actions {
      display: flex;
      justify-content: center;
      gap: 10px;
    }

    .rpjs-hub-menu {
      bottom: calc(max(12px, env(safe-area-inset-bottom)) + 58px);
      left: calc(max(12px, env(safe-area-inset-left)) + 104px);
      width: min(340px, calc(100vw - 24px));
      padding: 8px;
      border-radius: var(--rpjs-radius-lg);
    }

    .rpjs-hub-menu-title {
      padding: 8px 10px 12px;
      color: var(--rpjs-warning);
      font-size: 12px;
    }

    .rpjs-hub-menu-item {
      min-height: 58px;
      gap: 12px;
      padding: 8px 10px;
      border-radius: 10px;
      color: var(--rpjs-text-muted);
    }

    .rpjs-hub-menu-item:hover {
      background: var(--rpjs-surface-hover);
      color: var(--rpjs-text);
    }

    .rpjs-hub-menu-copy {
      display: flex;
      flex: 1;
      min-width: 0;
      flex-direction: column;
      gap: 2px;
    }

    .rpjs-hub-menu-label {
      color: var(--rpjs-text);
      font-size: 13px;
      font-weight: 650;
    }

    .rpjs-hub-menu-description {
      color: var(--rpjs-text-subtle);
      font-size: 11px;
      line-height: 1.3;
    }

    .rpjs-hub-menu-status {
      color: var(--rpjs-text-subtle);
    }

    .rpjs-hub-menu-status.rpjs-on {
      background: rgba(121, 217, 139, 0.15);
      color: var(--rpjs-success);
    }

    .rpjs-poll-modal {
      width: min(480px, 100%);
    }

    .rpjs-poll-answer-row {
      gap: 8px;
    }

    .rpjs-poll-remove-btn {
      width: 44px;
      height: 44px;
      padding: 0;
      border: 1px solid rgba(255, 123, 123, 0.34);
      border-radius: 10px;
      background: rgba(255, 123, 123, 0.12);
      color: var(--rpjs-danger);
    }

    .rpjs-poll-add-btn {
      min-height: 44px;
      border-color: var(--rpjs-border);
      border-radius: 10px;
      color: var(--rpjs-text-muted);
    }

    .rpjs-poll-options-panel {
      padding: 12px;
      border-color: var(--rpjs-border-subtle);
      background: rgba(255, 255, 255, 0.035);
    }

    .rpjs-poll-option-field,
    .rpjs-poll-check-option {
      min-height: 44px;
      color: var(--rpjs-text-muted);
      font-size: 13px;
    }

    .rpjs-poll-check-option input {
      width: 20px;
      height: 20px;
    }

    .rpjs-poll-publish-btn,
    .rpjs-poll-submit-vote {
      background: var(--rpjs-warning);
      color: var(--rpjs-warning-ink);
    }

    .rpjs-poll-publish-btn:hover:not(:disabled),
    .rpjs-poll-submit-vote:hover:not(:disabled) {
      background: #ffd092;
    }

    .rpjs-poll-vote-option {
      min-height: 48px;
      border-color: var(--rpjs-control-border);
      background: var(--rpjs-surface-interactive);
      color: var(--rpjs-text);
    }

    .rpjs-poll-vote-option:hover,
    .rpjs-poll-vote-option.rpjs-selected {
      border-color: rgba(255, 189, 102, 0.62);
      background: rgba(255, 189, 102, 0.16);
    }

    .rpjs-poll-vote-meta,
    .rpjs-poll-vote-hint,
    .rpjs-poll-results-summary,
    .rpjs-poll-result-meta {
      color: var(--rpjs-text-subtle);
    }

    .rpjs-poll-result-text,
    .rpjs-poll-results-question {
      color: var(--rpjs-text);
    }

    .rpjs-context-menu {
      min-width: 210px;
      padding: 5px;
      border-radius: 12px;
    }

    .rpjs-context-menu-item {
      width: 100%;
      min-height: 44px;
      padding: 8px 10px;
      border: 0;
      border-radius: 8px;
      background: transparent;
      color: var(--rpjs-text-muted);
      font: inherit;
      text-align: left;
    }

    .rpjs-context-menu-item:hover {
      background: var(--rpjs-surface-hover);
    }

    .rpjs-pong-exit,
    .rpjs-arena-exit {
      min-width: 44px;
      min-height: 44px;
      border-color: var(--rpjs-border);
      border-radius: 10px;
      background: rgba(4, 8, 14, 0.76);
      color: var(--rpjs-text);
      font-size: 13px;
    }

    .rpjs-arena-controls {
      color: var(--rpjs-text-muted);
      font-size: 12px;
    }

    .rpjs-arena-scoreboard {
      color: var(--rpjs-text);
      font-size: 12px;
    }

    .rpjs-arena-event {
      color: var(--rpjs-text);
      font-size: 11px;
    }

    .rpjs-arena-item-legend {
      color: var(--rpjs-text-muted);
      font-size: 11px;
    }

    @media (max-width: 600px) {
      .rpjs-toolbar {
        right: max(12px, env(safe-area-inset-right));
        left: auto !important;
      }

      .rpjs-lobby-panel {
        inset: max(12px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) calc(max(12px, env(safe-area-inset-bottom)) + 60px) max(8px, env(safe-area-inset-left)) !important;
        width: auto !important;
        min-width: 0;
        max-width: none;
        height: auto !important;
        min-height: 0;
        max-height: none;
        resize: none;
      }

      .rpjs-resize-handle {
        display: none;
      }

      .rpjs-lobby-header {
        cursor: default;
      }

      .rpjs-hub-menu {
        right: max(8px, env(safe-area-inset-right));
        bottom: calc(max(12px, env(safe-area-inset-bottom)) + 60px);
        left: max(8px, env(safe-area-inset-left));
        width: auto;
      }

      .rpjs-modal,
      .rpjs-poll-vote-card {
        max-height: calc(100dvh - 24px);
        padding: 20px;
      }

      .rpjs-confirm-actions {
        flex-direction: column-reverse;
      }

      .rpjs-confirm-actions button {
        width: 100%;
      }

      .rpjs-poll-option-field {
        align-items: flex-start;
        flex-direction: column;
      }

      .rpjs-poll-select {
        width: 100%;
      }

      .rpjs-arena-hud {
        top: max(8px, env(safe-area-inset-top));
        max-width: calc(100vw - 132px);
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }

      .rpjs-arena-scoreboard {
        top: 62px;
        right: 8px;
        max-width: 46vw;
      }

      .rpjs-arena-event-feed {
        top: 62px;
        left: 8px;
        width: 46vw;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .rpjs-toolbar button,
      .rpjs-lobby-panel,
      .rpjs-modal-overlay,
      .rpjs-modal,
      .rpjs-hub-menu,
      .rpjs-context-menu,
      .rpjs-poll-vote-overlay,
      .rpjs-poll-vote-card,
      .rpjs-poll-timer-fill,
      .rpjs-poll-result-bar-fill,
      .rpjs-toggle::before,
      .rpjs-toggle::after,
      .rpjs-status-dot {
        animation: none !important;
        scroll-behavior: auto !important;
        transition-duration: 0.01ms !important;
      }
    }

    @media (forced-colors: active) {
      .rpjs-toolbar,
      .rpjs-lobby-panel,
      .rpjs-modal,
      .rpjs-hub-menu,
      .rpjs-context-menu,
      .rpjs-poll-vote-card {
        border: 1px solid CanvasText;
        background: Canvas;
        color: CanvasText;
        forced-color-adjust: auto;
      }

      .rpjs-status-dot,
      .rpjs-user-dot,
      .rpjs-chat-identity-dot,
      .rpjs-arena-event-dot {
        border: 1px solid CanvasText;
      }
    }
    .rpjs-high-contrast {
      --rpjs-surface: #000;
      --rpjs-surface-raised: #000;
      --rpjs-surface-interactive: #111;
      --rpjs-surface-hover: #252525;
      --rpjs-border: #fff;
      --rpjs-control-border: #fff;
      --rpjs-border-subtle: #cfcfcf;
      --rpjs-text: #fff;
      --rpjs-text-muted: #fff;
      --rpjs-text-subtle: #e4e4e4;
      --rpjs-primary: #8de3ff;
      --rpjs-warning: #ffd18f;
      --rpjs-success: #9bf0a9;
      --rpjs-danger: #ffaaaa;
    }

    .rpjs-high-contrast .rpjs-toolbar,
    .rpjs-high-contrast .rpjs-lobby-panel,
    .rpjs-high-contrast .rpjs-modal,
    .rpjs-high-contrast .rpjs-hub-menu,
    .rpjs-high-contrast .rpjs-context-menu,
    .rpjs-high-contrast .rpjs-poll-vote-card {
      border-width: 2px;
      background: #000;
      box-shadow: 0 0 0 1px #000, 0 0 0 3px #fff;
      backdrop-filter: none;
      -webkit-backdrop-filter: none;
    }

    .rpjs-high-contrast .rpjs-field-help,
    .rpjs-high-contrast .rpjs-toggle-description,
    .rpjs-high-contrast .rpjs-empty-state,
    .rpjs-high-contrast .rpjs-hub-menu-description {
      color: #fff;
    }

`
