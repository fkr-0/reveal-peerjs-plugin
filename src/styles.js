/**
 * CSS styles for the plugin UI
 */

export const STYLES_ID = 'reveal-peerjs-styles';

export function injectStyles() {
  if (document.getElementById(STYLES_ID)) return;

  const style = document.createElement('style');
  style.id = STYLES_ID;
  style.textContent = `
    /* ========== Toolbar ========== */
    .rpjs-toolbar {
      position: fixed !important;
      bottom: 12px !important;
      left: 12px !important;
      display: flex !important;
      gap: 4px;
      z-index: 10003 !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      pointer-events: auto;
      visibility: visible !important;
      opacity: 1 !important;
    }

    .rpjs-toolbar button {
      width: 36px !important;
      height: 36px !important;
      min-width: 36px !important;
      min-height: 36px !important;
      border: none !important;
      border-radius: 6px;
      background: rgba(30, 30, 30, 0.75) !important;
      color: rgba(255, 255, 255, 0.8) !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.2s ease;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      padding: 0 !important;
      outline: none;
      visibility: visible !important;
      opacity: 1 !important;
    }

    .rpjs-toolbar button:hover {
      background: rgba(50, 50, 50, 0.9);
      color: #fff;
      transform: scale(1.08);
    }

    .rpjs-toolbar button.rpjs-active {
      background: rgba(79, 195, 247, 0.6);
      color: #fff;
    }

    .rpjs-toolbar button.rpjs-hub-btn {
      background: rgba(255, 167, 38, 0.7);
    }

    .rpjs-toolbar button.rpjs-hub-btn:hover {
      background: rgba(255, 167, 38, 0.9);
    }

    /* ========== Lobby Panel ========== */
    .rpjs-lobby-panel {
      position: fixed;
      bottom: 56px;
      left: 12px;
      width: 340px;
      min-width: 280px;
      max-width: 600px;
      height: 480px;
      min-height: 300px;
      max-height: 80vh;
      border-radius: 12px;
      background: rgba(20, 20, 25, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 9998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #e0e0e0;
      font-size: 13px;
      animation: rpjs-fade-up 0.2s ease;
      resize: both;
    }

    .rpjs-resize-handle {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 20px;
      height: 20px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.2) 50%);
      border-radius: 0 0 12px 0;
      pointer-events: auto;
    }

    .rpjs-resize-handle:hover {
      background: linear-gradient(135deg, transparent 50%, rgba(255, 255, 255, 0.4) 50%);
    }

    @keyframes rpjs-fade-up {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .rpjs-lobby-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      font-weight: 600;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.9);
      cursor: grab;
      user-select: none;
    }

    .rpjs-lobby-header:active {
      cursor: grabbing;
    }

    .rpjs-lobby-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      padding: 2px;
      display: flex;
      align-items: center;
      transition: color 0.2s;
    }

    .rpjs-lobby-close:hover {
      color: #fff;
    }

    /* Users list */
    .rpjs-users-section {
      padding: 6px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      max-height: 140px;
      overflow-y: auto;
    }

    .rpjs-users-section::-webkit-scrollbar {
      width: 4px;
    }

    .rpjs-users-section::-webkit-scrollbar-track {
      background: transparent;
    }

    .rpjs-users-section::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
    }

    .rpjs-user-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 14px;
      cursor: pointer;
      transition: background 0.15s;
      border-radius: 4px;
      margin: 0 4px;
    }

    .rpjs-user-item:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .rpjs-user-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .rpjs-user-name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 12px;
    }

    .rpjs-user-hub-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(255, 167, 38, 0.25);
      color: #ffa726;
      font-weight: 600;
    }

    .rpjs-user-self-tag {
      font-size: 10px;
      padding: 1px 5px;
      border-radius: 3px;
      background: rgba(79, 195, 247, 0.2);
      color: #4fc3f7;
      font-weight: 500;
    }

    /* Chat area */
    .rpjs-chat-section {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 6px 10px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }

    .rpjs-chat-section::-webkit-scrollbar {
      width: 4px;
    }

    .rpjs-chat-section::-webkit-scrollbar-track {
      background: transparent;
    }

    .rpjs-chat-section::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 2px;
    }

    .rpjs-chat-msg {
      padding: 3px 6px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.4;
      word-break: break-word;
    }

    .rpjs-chat-msg:hover {
      background: rgba(255, 255, 255, 0.03);
    }

    .rpjs-chat-msg-private {
      background: rgba(156, 39, 176, 0.1);
      border-left: 2px solid rgba(156, 39, 176, 0.4);
    }

    .rpjs-chat-username {
      font-weight: 600;
      margin-right: 6px;
    }

    .rpjs-chat-text {
      color: rgba(255, 255, 255, 0.8);
    }

    .rpjs-chat-private-label {
      font-size: 10px;
      color: rgba(156, 39, 176, 0.7);
      margin-right: 4px;
    }

    .rpjs-chat-system {
      color: rgba(255, 255, 255, 0.4);
      font-style: italic;
      font-size: 11px;
    }

    /* Chat input area */
    .rpjs-chat-input-area {
      display: flex;
      gap: 4px;
      padding: 8px 10px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      align-items: center;
    }

    .rpjs-chat-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 6px 10px;
      color: #e0e0e0;
      font-size: 12px;
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
    }

    .rpjs-chat-input:focus {
      border-color: rgba(79, 195, 247, 0.5);
    }

    .rpjs-chat-input::placeholder {
      color: rgba(255, 255, 255, 0.3);
    }

    .rpjs-target-dropdown {
      position: relative;
      display: flex;
      align-items: center;
    }

    .rpjs-target-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: #e0e0e0;
      padding: 5px 8px;
      font-size: 11px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      font-family: inherit;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .rpjs-target-btn:hover {
      background: rgba(255, 255, 255, 0.14);
    }

    .rpjs-target-btn.rpjs-private-active {
      border-color: rgba(156, 39, 176, 0.5);
      color: #ce93d8;
    }

    .rpjs-target-dropdown-list {
      position: absolute;
      bottom: 100%;
      left: 0;
      background: rgba(30, 30, 35, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      min-width: 160px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 10000;
      margin-bottom: 4px;
      display: none;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
    }

    .rpjs-target-dropdown-list.rpjs-open {
      display: block;
    }

    .rpjs-target-dropdown-item {
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.15s;
    }

    .rpjs-target-dropdown-item:hover {
      background: rgba(255, 255, 255, 0.08);
    }

    .rpjs-send-btn {
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 6px;
      background: rgba(79, 195, 247, 0.5);
      color: #fff;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .rpjs-send-btn:hover {
      background: rgba(79, 195, 247, 0.7);
    }

    /* ========== Settings Modal ========== */
    .rpjs-modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: rpjs-fade-in 0.15s ease;
    }

    @keyframes rpjs-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .rpjs-modal {
      background: rgba(28, 28, 32, 0.97);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      padding: 24px;
      width: 360px;
      max-width: 90vw;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      color: #e0e0e0;
      animation: rpjs-scale-in 0.2s ease;
    }

    @keyframes rpjs-scale-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }

    .rpjs-modal-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #fff;
    }

    .rpjs-modal-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      padding: 2px;
      display: flex;
      transition: color 0.2s;
    }

    .rpjs-modal-close:hover {
      color: #fff;
    }

    .rpjs-field {
      margin-bottom: 16px;
    }

    .rpjs-field-label {
      display: block;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    .rpjs-field-input {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px 12px;
      color: #e0e0e0;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
      box-sizing: border-box;
    }

    .rpjs-field-input:focus {
      border-color: rgba(79, 195, 247, 0.5);
    }

    .rpjs-color-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rpjs-color-picker {
      width: 40px;
      height: 32px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      cursor: pointer;
      padding: 2px;
      background: transparent;
    }

    .rpjs-color-hex {
      flex: 1;
    }

    .rpjs-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
    }

    .rpjs-toggle-label {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
    }

    .rpjs-toggle {
      position: relative;
      width: 40px;
      height: 22px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 11px;
      cursor: pointer;
      transition: background 0.2s;
      border: none;
      outline: none;
    }

    .rpjs-toggle.rpjs-active {
      background: rgba(79, 195, 247, 0.6);
    }

    .rpjs-toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
    }

    .rpjs-toggle.rpjs-active::after {
      transform: translateX(18px);
    }

    .rpjs-save-btn {
      width: 100%;
      padding: 10px;
      background: rgba(79, 195, 247, 0.4);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      margin-top: 8px;
      font-family: inherit;
    }

    .rpjs-save-btn:hover {
      background: rgba(79, 195, 247, 0.6);
    }

    /* ========== Hub Menu ========== */
    .rpjs-hub-menu {
      position: fixed;
      bottom: 56px;
      left: 88px;
      width: 280px;
      border-radius: 12px;
      background: rgba(20, 20, 25, 0.92);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 167, 38, 0.15);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      z-index: 9998;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 10px;
      color: #e0e0e0;
      animation: rpjs-fade-up 0.2s ease;
    }

    .rpjs-hub-menu-title {
      font-size: 12px;
      font-weight: 600;
      color: #ffa726;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4px 8px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      margin-bottom: 6px;
    }

    .rpjs-hub-menu-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
    }

    .rpjs-hub-menu-item:hover {
      background: rgba(255, 255, 255, 0.06);
      color: #fff;
    }

    .rpjs-hub-menu-item.rpjs-active-feature {
      background: rgba(255, 167, 38, 0.15);
      color: #ffa726;
    }

    .rpjs-hub-menu-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
    }

    .rpjs-hub-menu-label {
      flex: 1;
    }

    .rpjs-hub-menu-status {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.08);
      color: rgba(255, 255, 255, 0.5);
    }

    .rpjs-hub-menu-status.rpjs-on {
      background: rgba(76, 175, 80, 0.2);
      color: #66bb6a;
    }

    /* ========== Poll Modal ========== */
    .rpjs-poll-modal {
      width: 400px;
    }

    .rpjs-poll-question-input {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 10px 12px;
      color: #e0e0e0;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
      box-sizing: border-box;
      margin-bottom: 12px;
    }

    .rpjs-poll-question-input:focus {
      border-color: rgba(255, 167, 38, 0.5);
    }

    .rpjs-poll-answers {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }

    .rpjs-poll-answer-row {
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .rpjs-poll-answer-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 7px 10px;
      color: #e0e0e0;
      font-size: 13px;
      outline: none;
      font-family: inherit;
    }

    .rpjs-poll-answer-input:focus {
      border-color: rgba(255, 167, 38, 0.4);
    }

    .rpjs-poll-remove-btn {
      background: rgba(244, 67, 54, 0.2);
      border: none;
      border-radius: 4px;
      color: #ef5350;
      cursor: pointer;
      padding: 5px 8px;
      font-size: 14px;
    }

    .rpjs-poll-remove-btn:hover {
      background: rgba(244, 67, 54, 0.35);
    }

    .rpjs-poll-add-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px dashed rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.5);
      cursor: pointer;
      padding: 6px;
      font-size: 12px;
      width: 100%;
      font-family: inherit;
      transition: all 0.2s;
    }

    .rpjs-poll-add-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.7);
    }

    .rpjs-poll-publish-btn {
      width: 100%;
      padding: 10px;
      background: rgba(255, 167, 38, 0.5);
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.2s;
      font-family: inherit;
    }

    .rpjs-poll-publish-btn:hover {
      background: rgba(255, 167, 38, 0.7);
    }

    /* Poll vote overlay */
    .rpjs-poll-vote-overlay {
      position: fixed;
      inset: 0;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.6);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: rpjs-fade-in 0.15s ease;
    }

    .rpjs-poll-vote-card {
      background: rgba(28, 28, 32, 0.97);
      border: 1px solid rgba(255, 167, 38, 0.2);
      border-radius: 14px;
      padding: 24px;
      width: 380px;
      max-width: 90vw;
      color: #e0e0e0;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
      animation: rpjs-scale-in 0.2s ease;
    }

    .rpjs-poll-vote-question {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #fff;
    }

    .rpjs-poll-vote-options {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .rpjs-poll-vote-option {
      padding: 10px 14px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
      color: #e0e0e0;
      text-align: left;
      font-family: inherit;
    }

    .rpjs-poll-vote-option:hover {
      background: rgba(255, 167, 38, 0.15);
      border-color: rgba(255, 167, 38, 0.3);
    }

    .rpjs-poll-timer-bar {
      width: 100%;
      height: 4px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
      overflow: hidden;
    }

    .rpjs-poll-timer-fill {
      height: 100%;
      background: linear-gradient(90deg, #ffa726, #ff7043);
      border-radius: 2px;
      transition: width 0.1s linear;
    }

    /* Poll results */
    .rpjs-poll-results-card {
      width: 380px;
    }

    .rpjs-poll-result-row {
      margin-bottom: 12px;
    }

    .rpjs-poll-result-label {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .rpjs-poll-result-bar-bg {
      width: 100%;
      height: 8px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 4px;
      overflow: hidden;
    }

    .rpjs-poll-result-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #ffa726, #ff7043);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    /* ========== Pong Overlay ========== */
    .rpjs-pong-overlay {
      position: fixed;
      inset: 0;
      z-index: 10001;
      background: rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: none;
      touch-action: none;
    }

    .rpjs-pong-canvas {
      width: 100%;
      height: 100%;
    }

    .rpjs-pong-hud {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 30px;
      align-items: center;
      color: #fff;
      font-size: 24px;
      font-weight: 700;
      text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    }

    .rpjs-pong-score {
      min-width: 30px;
      text-align: center;
    }

    .rpjs-pong-divider {
      color: rgba(255, 255, 255, 0.3);
      font-size: 20px;
    }

    .rpjs-pong-players {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 20px;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    }

    .rpjs-pong-exit {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.7);
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      z-index: 10002;
      cursor: pointer;
    }

    .rpjs-pong-exit:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    /* ========== Context Menu ========== */
    .rpjs-context-menu {
      position: fixed;
      z-index: 10001;
      background: rgba(28, 28, 32, 0.97);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 4px;
      min-width: 150px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: rpjs-fade-in 0.1s ease;
    }

    .rpjs-context-menu-item {
      padding: 7px 12px;
      cursor: pointer;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.8);
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background 0.15s;
    }

    .rpjs-context-menu-item:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #fff;
    }

    /* ========== High Contrast Mode ========== */
    .rpjs-high-contrast .rpjs-toolbar button {
      background: rgba(0, 0, 0, 0.9);
      border: 2px solid #fff;
      color: #fff;
    }

    .rpjs-high-contrast .rpjs-lobby-panel,
    .rpjs-high-contrast .rpjs-hub-menu,
    .rpjs-high-contrast .rpjs-modal {
      background: rgba(0, 0, 0, 0.95);
      border: 2px solid #fff;
    }

    .rpjs-high-contrast .rpjs-chat-input,
    .rpjs-high-contrast .rpjs-field-input,
    .rpjs-high-contrast .rpjs-poll-question-input,
    .rpjs-high-contrast .rpjs-poll-answer-input {
      border: 2px solid rgba(255, 255, 255, 0.5);
      background: rgba(255, 255, 255, 0.1);
    }

    .rpjs-high-contrast .rpjs-chat-msg {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* ========== Dark Mode (presentation override) ========== */
    .rpjs-dark-mode .reveal {
      color: #e0e0e0;
    }

    .rpjs-dark-mode .reveal .slides section {
      color: #e0e0e0;
    }

    .rpjs-dark-mode .reveal .slides section h1,
    .rpjs-dark-mode .reveal .slides section h2,
    .rpjs-dark-mode .reveal .slides section h3 {
      color: #fff;
    }

    /* Connection status indicator */
    .rpjs-status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #4caf50;
      margin-left: 6px;
      animation: rpjs-pulse 2s ease infinite;
    }

    .rpjs-status-dot.rpjs-offline {
      background: #f44336;
      animation: none;
    }

    .rpjs-status-dot.rpjs-connecting {
      background: #ff9800;
    }

    @keyframes rpjs-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* Notification badge */
    .rpjs-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      width: 14px;
      height: 14px;
      background: #f44336;
      border-radius: 50%;
      font-size: 8px;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      pointer-events: none;
    }

    /* ========== Arena Overlay ========== */
    .rpjs-arena-overlay {
      position: fixed;
      inset: 0;
      z-index: 10001;
      background: rgba(10, 10, 18, 0.88);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      cursor: crosshair;
      touch-action: none;
    }

    .rpjs-arena-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    .rpjs-arena-hud {
      position: absolute;
      top: 16px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      gap: 16px;
      align-items: center;
      color: #fff;
      font-size: 13px;
      font-weight: 600;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
      pointer-events: none;
    }

    .rpjs-arena-hud-title {
      font-size: 15px;
      color: #ffa726;
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .rpjs-arena-exit {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 6px;
      color: rgba(255, 255, 255, 0.7);
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
      font-family: inherit;
      z-index: 10002;
    }

    .rpjs-arena-exit:hover {
      background: rgba(255, 255, 255, 0.2);
    }

    .rpjs-arena-controls {
      position: absolute;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      color: rgba(255, 255, 255, 0.4);
      font-size: 11px;
      pointer-events: none;
      text-align: center;
    }

    .rpjs-arena-scoreboard {
      position: absolute;
      top: 44px;
      right: 16px;
      background: rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      pointer-events: none;
      min-width: 140px;
    }

    .rpjs-arena-scoreboard-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
    }

    .rpjs-arena-scoreboard-name {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .rpjs-arena-scoreboard-hp {
      font-weight: 600;
    }

    .rpjs-arena-scoreboard-hp.hit {
      color: #ff9800;
    }

    .rpjs-arena-scoreboard-hp.alive {
      color: #4caf50;
    }

    /* Arena touch controls (mobile) */
    .rpjs-arena-touch-controls {
      display: none;
    }

    @media (pointer: coarse), (hover: none) {
      .rpjs-arena-touch-controls {
        display: block;
      }
      .rpjs-arena-controls {
        display: none;
      }
    }

    .rpjs-arena-joystick {
      position: absolute;
      bottom: 30px;
      left: 30px;
      width: 130px;
      height: 130px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.06);
      border: 2px solid rgba(255, 255, 255, 0.15);
      z-index: 10002;
    }

    .rpjs-arena-joystick-knob {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      pointer-events: none;
      transition: none;
    }

    .rpjs-arena-shoot-btn {
      position: absolute;
      bottom: 30px;
      right: 30px;
      width: 90px;
      height: 90px;
      border-radius: 50%;
      background: rgba(244, 67, 54, 0.25);
      border: 2px solid rgba(244, 67, 54, 0.5);
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      font-weight: 700;
      font-family: inherit;
      letter-spacing: 1px;
      z-index: 10002;
      cursor: pointer;
    }

    .rpjs-arena-shoot-btn:active {
      background: rgba(244, 67, 54, 0.5);
    }

    /* Pong touch controls */
    .rpjs-pong-exit {
      min-width: 44px;
      min-height: 44px;
    }
  `;

  document.head.appendChild(style);
}

export function removeStyles() {
  const el = document.getElementById(STYLES_ID);
  if (el) el.remove();
}
