const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisible(element) {
  if (!(element instanceof HTMLElement)) return false;
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

export function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisible);
}

/**
 * Activates expected modal-dialog keyboard behavior without owning removal.
 * The caller remains responsible for removing the overlay and invoking cleanup.
 */
export function activateModal(overlay, {
  initialFocus = null,
  onRequestClose = null,
  closeOnBackdrop = true,
  closeOnEscape = true,
  restoreFocus = true,
} = {}) {
  const previousFocus = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  const dialog = overlay?.querySelector('[role="dialog"], [role="alertdialog"]');
  if (dialog) dialog.setAttribute('aria-modal', 'true');

  let active = true;
  const resolveInitialFocus = () => {
    if (typeof initialFocus === 'string') return overlay.querySelector(initialFocus);
    if (initialFocus instanceof HTMLElement) return initialFocus;
    return getFocusableElements(dialog || overlay)[0] || dialog || overlay;
  };

  const keyHandler = (event) => {
    if (!active) return;
    if (event.key === 'Escape' && closeOnEscape && onRequestClose) {
      event.preventDefault();
      onRequestClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(dialog || overlay);
    if (focusable.length === 0) {
      event.preventDefault();
      (dialog || overlay)?.focus?.();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const backdropHandler = (event) => {
    if (active && closeOnBackdrop && event.target === overlay && onRequestClose) {
      onRequestClose();
    }
  };

  document.addEventListener('keydown', keyHandler);
  overlay?.addEventListener('click', backdropHandler);
  requestAnimationFrame(() => {
    const target = resolveInitialFocus();
    if (target && active) {
      if (!target.hasAttribute('tabindex') && !target.matches?.(FOCUSABLE_SELECTOR)) {
        target.setAttribute('tabindex', '-1');
      }
      target.focus?.();
    }
  });

  return ({ restoreFocus: shouldRestoreFocus = restoreFocus } = {}) => {
    if (!active) return;
    active = false;
    document.removeEventListener('keydown', keyHandler);
    overlay?.removeEventListener('click', backdropHandler);
    if (shouldRestoreFocus && previousFocus?.isConnected) previousFocus.focus();
  };
}

export function setExpanded(button, expanded) {
  if (!button) return;
  button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  button.classList.toggle('rpjs-active', Boolean(expanded));
}
