/**
 * math.js — MathJax integration helpers
 *
 * MathJax 3 quirk: startup.promise resolves before the tex-svg extension
 * has registered typesetPromise. We poll until typesetPromise appears.
 */
window.MathHelper = {
  _pending: [],
  _maxRetries: 20,

  requestTypeset(element) {
    if (!element) return;
    this._pending.push(element);
    this._tryTypeset(0);
  },

  async _tryTypeset(attempt) {
    if (this._pending.length === 0) return;
    if (attempt >= this._maxRetries) return;

    if (!window.MathJax || !window.MathJax.startup) {
      setTimeout(() => this._tryTypeset(attempt + 1), 200);
      return;
    }

    await window.MathJax.startup.promise;

    if (!window.MathJax.typesetPromise) {
      setTimeout(() => this._tryTypeset(attempt + 1), 200);
      return;
    }

    const els = [...new Set(this._pending)];
    this._pending = [];

    try {
      await window.MathJax.typesetPromise(els);
    } catch (err) {
      console.warn('[MathHelper] typeset error:', err.message);
    }
  },

  clear(element) {
    if (!window.MathJax || !MathJax.typesetPromise) return;
    try {
      MathJax.typesetClear([element]);
    } catch (_) {}
  }
};
