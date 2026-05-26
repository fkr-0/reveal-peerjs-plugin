/**
 * Settings Modal UI
 */

import { USER_ICON, CLOSE_ICON } from './icons.js';
import { loadSettings, saveSettings } from './settings.js';

export class SettingsModal {
  constructor(network, settings, onSettingsChange) {
    this.network = network;
    this.settings = { ...settings };
    this.onSettingsChange = onSettingsChange;
    this.el = null;
  }

  render() {
    if (this.el) this.el.remove();

    const overlay = document.createElement('div');
    overlay.className = 'rpjs-modal-overlay';

    overlay.innerHTML = `
      <div class="rpjs-modal">
        <div class="rpjs-modal-title">
          <span>Settings</span>
          <button class="rpjs-modal-close" id="rpjs-settings-close">${CLOSE_ICON}</button>
        </div>

        <div class="rpjs-field">
          <label class="rpjs-field-label">Username</label>
          <input type="text" class="rpjs-field-input" id="rpjs-settings-username" 
                 value="${this._escapeAttr(this.settings.username)}" maxlength="24">
        </div>

        <div class="rpjs-field">
          <label class="rpjs-field-label">Custom Color</label>
          <div class="rpjs-color-row">
            <input type="color" class="rpjs-color-picker" id="rpjs-settings-color-picker" 
                   value="${this.settings.color}">
            <input type="text" class="rpjs-field-input rpjs-color-hex" id="rpjs-settings-color-hex" 
                   value="${this.settings.color}" maxlength="7">
          </div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span class="rpjs-toggle-label">Go Offline</span>
            <button class="rpjs-toggle ${this.settings.goOffline ? 'rpjs-active' : ''}" 
                    id="rpjs-toggle-offline" role="switch" 
                    aria-checked="${this.settings.goOffline}"></button>
          </div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span class="rpjs-toggle-label">Dark Mode</span>
            <button class="rpjs-toggle ${this.settings.darkMode ? 'rpjs-active' : ''}" 
                    id="rpjs-toggle-darkmode" role="switch"
                    aria-checked="${this.settings.darkMode}"></button>
          </div>
        </div>

        <div class="rpjs-field">
          <div class="rpjs-toggle-row">
            <span class="rpjs-toggle-label">High Contrast / Assisted Visuals</span>
            <button class="rpjs-toggle ${this.settings.highContrast ? 'rpjs-active' : ''}" 
                    id="rpjs-toggle-highcontrast" role="switch"
                    aria-checked="${this.settings.highContrast}"></button>
          </div>
        </div>

        <button class="rpjs-save-btn" id="rpjs-settings-save">Save & Apply</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this.el = overlay;
    this._bindEvents();
  }

  _bindEvents() {
    // Close
    this.el.querySelector('#rpjs-settings-close').addEventListener('click', () => {
      this.close();
    });

    // Click overlay to close
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    // Color picker ↔ hex sync
    const picker = this.el.querySelector('#rpjs-settings-color-picker');
    const hex = this.el.querySelector('#rpjs-settings-color-hex');

    picker.addEventListener('input', () => {
      hex.value = picker.value;
    });

    hex.addEventListener('input', () => {
      if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) {
        picker.value = hex.value;
      }
    });

    // Toggle buttons
    this._bindToggle('rpjs-toggle-offline', 'goOffline', (val) => {
      if (val) {
        this.network.goOffline();
      } else {
        this.network.goOnline();
      }
    });

    this._bindToggle('rpjs-toggle-darkmode', 'darkMode', (val) => {
      document.body.classList.toggle('rpjs-dark-mode', val);
    });

    this._bindToggle('rpjs-toggle-highcontrast', 'highContrast', (val) => {
      document.body.classList.toggle('rpjs-high-contrast', val);
    });

    // Save
    this.el.querySelector('#rpjs-settings-save').addEventListener('click', () => {
      this._save();
    });
  }

  _bindToggle(id, key, onChange) {
    const btn = this.el.querySelector(`#${id}`);
    btn.addEventListener('click', () => {
      this.settings[key] = !this.settings[key];
      btn.classList.toggle('rpjs-active', this.settings[key]);
      btn.setAttribute('aria-checked', this.settings[key]);
      if (onChange) onChange(this.settings[key]);
    });
  }

  _save() {
    const username = this.el.querySelector('#rpjs-settings-username').value.trim();
    const color = this.el.querySelector('#rpjs-settings-color-hex').value.trim();

    if (username) this.settings.username = username;
    if (/^#[0-9a-fA-F]{6}$/.test(color)) this.settings.color = color;

    saveSettings(this.settings);

    // Update network profile
    this.network.updateProfile(this.settings.username, this.settings.color);

    if (this.onSettingsChange) {
      this.onSettingsChange(this.settings);
    }

    this.close();
  }

  _escapeAttr(str) {
    return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  show() {
    this.render();
  }

  close() {
    if (this.el) {
      this.el.remove();
      this.el = null;
    }
  }

  destroy() {
    this.close();
  }
}
