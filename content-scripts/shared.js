// shared.js — Persistent job-detection widget used by all content scripts
// Shows a floating card with detected job info; updates live when user switches jobs.

window.JobLog = window.JobLog || {};

(function () {
  let widgetEl = null;
  let isMinimized = false;
  let currentData = { company: "", title: "", source: "" };
  let isSaved = false;

  // ── Escape HTML ──
  function esc(str) {
    return (str || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;");
  }

  // ── Inject styles once ──
  function injectStyles() {
    if (document.getElementById("joblog-styles")) return;
    const style = document.createElement("style");
    style.id = "joblog-styles";
    style.textContent = `
      @keyframes joblog-slidein {
        from { opacity: 0; transform: translateY(20px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes joblog-fadeout {
        from { opacity: 1; transform: scale(1); }
        to   { opacity: 0; transform: scale(0.92); }
      }
      @keyframes joblog-pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(108,123,255,0.45); }
        50%      { box-shadow: 0 0 0 8px rgba(108,123,255,0); }
      }
      @keyframes joblog-check {
        0%   { transform: scale(0); }
        50%  { transform: scale(1.2); }
        100% { transform: scale(1); }
      }

      #joblog-widget,
      #joblog-widget * {
        box-sizing: border-box !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        line-height: 1.4 !important;
      }

      #joblog-widget {
        position: fixed !important;
        bottom: 70px !important;
        right: 24px !important;
        z-index: 2147483647 !important;
        animation: joblog-slidein 0.35s cubic-bezier(0.34,1.56,0.64,1) !important;
      }

      #joblog-widget .jl-card {
        background: #16171D !important;
        border: 1px solid #2C2D35 !important;
        border-radius: 14px !important;
        padding: 0 !important;
        width: 320px !important;
        box-shadow: 0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(108,123,255,0.08) !important;
        overflow: hidden !important;
        transition: all 0.3s cubic-bezier(0.4,0,0.2,1) !important;
      }

      #joblog-widget .jl-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 14px 16px 10px !important;
        border-bottom: 1px solid #222330 !important;
        background: linear-gradient(135deg, rgba(108,123,255,0.06) 0%, transparent 60%) !important;
      }

      #joblog-widget .jl-brand {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
      }

      #joblog-widget .jl-logo {
        color: #6C7BFF !important;
        font-size: 15px !important;
        font-weight: bold !important;
      }

      #joblog-widget .jl-brand-text {
        font-size: 12px !important;
        font-weight: 700 !important;
        color: #EDEDED !important;
        letter-spacing: 0.02em !important;
      }

      #joblog-widget .jl-source-badge {
        font-size: 10px !important;
        font-weight: 600 !important;
        color: #A5AEFF !important;
        background: rgba(108,123,255,0.12) !important;
        padding: 3px 8px !important;
        border-radius: 20px !important;
        letter-spacing: 0.02em !important;
      }

      #joblog-widget .jl-header-actions {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
      }

      #joblog-widget .jl-icon-btn {
        background: none !important;
        border: none !important;
        color: #6B6C78 !important;
        font-size: 16px !important;
        cursor: pointer !important;
        padding: 4px 6px !important;
        border-radius: 6px !important;
        transition: all 0.15s !important;
        line-height: 1 !important;
      }
      #joblog-widget .jl-icon-btn:hover {
        color: #EDEDED !important;
        background: rgba(255,255,255,0.06) !important;
      }

      #joblog-widget .jl-body {
        padding: 12px 16px 16px !important;
      }

      #joblog-widget .jl-field {
        margin-bottom: 10px !important;
      }
      #joblog-widget .jl-field:last-of-type {
        margin-bottom: 0 !important;
      }

      #joblog-widget .jl-label {
        display: block !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        color: #6B6C78 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.06em !important;
        margin-bottom: 4px !important;
      }

      #joblog-widget .jl-input {
        width: 100% !important;
        padding: 8px 10px !important;
        border-radius: 8px !important;
        border: 1px solid #2C2D35 !important;
        background: #1D1E24 !important;
        color: #EDEDED !important;
        font-size: 13px !important;
        transition: border-color 0.15s !important;
        outline: none !important;
        margin: 0 !important;
      }
      #joblog-widget .jl-input:focus {
        border-color: #6C7BFF !important;
        box-shadow: 0 0 0 2px rgba(108,123,255,0.15) !important;
      }
      #joblog-widget .jl-input:read-only {
        opacity: 0.6 !important;
        cursor: default !important;
      }

      #joblog-widget .jl-actions {
        display: flex !important;
        gap: 8px !important;
        margin-top: 14px !important;
      }

      #joblog-widget .jl-save-btn {
        flex: 1 !important;
        padding: 9px 14px !important;
        border: none !important;
        border-radius: 8px !important;
        background: linear-gradient(135deg, #6C7BFF, #5A67E8) !important;
        color: white !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        cursor: pointer !important;
        transition: all 0.2s !important;
        position: relative !important;
        overflow: hidden !important;
      }
      #joblog-widget .jl-save-btn:hover {
        background: linear-gradient(135deg, #5A69EE, #4D5BD4) !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 12px rgba(108,123,255,0.3) !important;
      }
      #joblog-widget .jl-save-btn:active {
        transform: translateY(0) !important;
      }

      #joblog-widget .jl-save-btn.jl-saved {
        background: linear-gradient(135deg, #2D8F5E, #27AE60) !important;
        cursor: default !important;
      }
      #joblog-widget .jl-save-btn.jl-saved:hover {
        transform: none !important;
        box-shadow: none !important;
      }

      #joblog-widget .jl-save-btn.jl-duplicate {
        background: rgba(242,201,76,0.15) !important;
        color: #F2C94C !important;
        cursor: default !important;
      }
      #joblog-widget .jl-save-btn.jl-duplicate:hover {
        transform: none !important;
        box-shadow: none !important;
      }

      #joblog-widget .jl-msg {
        font-size: 11px !important;
        text-align: center !important;
        min-height: 16px !important;
        margin-top: 6px !important;
        transition: opacity 0.2s !important;
      }

      /* ── Minimized state ── */
      #joblog-widget .jl-mini {
        display: none !important;
        width: 44px !important;
        height: 44px !important;
        border-radius: 50% !important;
        background: linear-gradient(135deg, #6C7BFF, #5A67E8) !important;
        border: none !important;
        color: white !important;
        font-size: 18px !important;
        cursor: pointer !important;
        box-shadow: 0 6px 24px rgba(108,123,255,0.35) !important;
        transition: all 0.2s !important;
        animation: joblog-pulse 2s infinite !important;
        align-items: center !important;
        justify-content: center !important;
      }
      #joblog-widget .jl-mini:hover {
        transform: scale(1.1) !important;
        box-shadow: 0 8px 32px rgba(108,123,255,0.5) !important;
      }

      #joblog-widget.jl-minimized .jl-card { display: none !important; }
      #joblog-widget.jl-minimized .jl-mini { display: flex !important; }
    `;
    const targetHeader = document.head || document.documentElement || document.body;
    if (targetHeader) {
      targetHeader.appendChild(style);
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        (document.head || document.documentElement || document.body).appendChild(style);
      });
    }
  }

  // ── Build the widget DOM ──
  function createWidget() {
    if (widgetEl) return;
    injectStyles();

    const today = new Date().toISOString().slice(0, 10);

    widgetEl = document.createElement("div");
    widgetEl.id = "joblog-widget";
    widgetEl.innerHTML = `
      <div class="jl-card">
        <div class="jl-header">
          <div class="jl-brand">
            <span class="jl-logo">◆</span>
            <span class="jl-brand-text">JobLog</span>
            <span class="jl-source-badge" id="jl-source"></span>
          </div>
          <div class="jl-header-actions">
            <button class="jl-icon-btn" id="jl-minimize" title="Minimize">─</button>
            <button class="jl-icon-btn" id="jl-close" title="Close">✕</button>
          </div>
        </div>
        <div class="jl-body">
          <div class="jl-field">
            <span class="jl-label">Company</span>
            <input class="jl-input" id="jl-company" type="text" placeholder="Company name" />
          </div>
          <div class="jl-field">
            <span class="jl-label">Job Title</span>
            <input class="jl-input" id="jl-title" type="text" placeholder="Job title" />
          </div>
          <div class="jl-field">
            <span class="jl-label">Date</span>
            <input class="jl-input" id="jl-date" type="date" value="${today}" />
          </div>
          <div class="jl-actions">
            <button class="jl-save-btn" id="jl-save">Save Application ✓</button>
          </div>
          <div class="jl-msg" id="jl-msg"></div>
        </div>
      </div>
      <button class="jl-mini" id="jl-mini-btn" title="JobLog — click to expand">◆</button>
    `;

    // Wait for body
    function attach() {
      if (document.body) {
        document.body.appendChild(widgetEl);
        bindEvents();
      } else {
        document.addEventListener("DOMContentLoaded", () => {
          document.body.appendChild(widgetEl);
          bindEvents();
        });
      }
    }
    attach();
  }

  // ── Bind widget events ──
  function bindEvents() {
    const closeBtn = document.getElementById("jl-close");
    const minimizeBtn = document.getElementById("jl-minimize");
    const miniBtn = document.getElementById("jl-mini-btn");
    const saveBtn = document.getElementById("jl-save");

    if (closeBtn) {
      closeBtn.onclick = () => {
        if (widgetEl) {
          widgetEl.style.animation = "joblog-fadeout 0.2s ease forwards";
          setTimeout(() => {
            if (widgetEl) {
              widgetEl.remove();
              widgetEl = null;
              isMinimized = false;
            }
          }, 200);
        }
      };
    }

    if (minimizeBtn) {
      minimizeBtn.onclick = () => {
        isMinimized = true;
        if (widgetEl) widgetEl.classList.add("jl-minimized");
      };
    }

    if (miniBtn) {
      miniBtn.onclick = () => {
        isMinimized = false;
        if (widgetEl) {
          widgetEl.classList.remove("jl-minimized");
          widgetEl.style.animation = "joblog-slidein 0.3s cubic-bezier(0.34,1.56,0.64,1)";
        }
      };
    }

    if (saveBtn) {
      saveBtn.onclick = handleSave;
    }
  }

  // ── Save handler ──
  async function handleSave() {
    const companyInput = document.getElementById("jl-company");
    const titleInput = document.getElementById("jl-title");
    const dateInput = document.getElementById("jl-date");
    const saveBtn = document.getElementById("jl-save");

    if (!companyInput || !titleInput || !dateInput) return;

    const company = companyInput.value.trim();
    const title = titleInput.value.trim();
    const date = dateInput.value;

    if (!company || !title) {
      setMsg("Please fill in Company and Job Title.", "#EB5757");
      return;
    }

    const entry = {
      id: crypto.randomUUID(),
      company,
      title,
      source: currentData.source || "Other",
      date,
      status: "Applied",
      heardBack: false,
      heardBackDate: null,
      notes: "",
    };

    try {
      const result = await chrome.runtime.sendMessage({
        type: "ADD_APPLICATION",
        payload: entry,
      });

      if (result && result.success) {
        isSaved = true;
        if (saveBtn) {
          saveBtn.textContent = "Saved ✓";
          saveBtn.classList.add("jl-saved");
          saveBtn.classList.remove("jl-duplicate");
        }
        setMsg("Application logged!", "#6FCF97");
      } else if (result && result.reason === "duplicate") {
        if (saveBtn) {
          saveBtn.textContent = "Already logged today";
          saveBtn.classList.add("jl-duplicate");
          saveBtn.classList.remove("jl-saved");
        }
        setMsg("This role is already in your log for today.", "#F2C94C");
      }
    } catch (e) {
      setMsg("Error saving — try the toolbar popup.", "#EB5757");
    }
  }

  // ── Show message ──
  function setMsg(text, color) {
    const el = document.getElementById("jl-msg");
    if (el) {
      el.textContent = text;
      el.style.color = color;
      el.style.opacity = "1";
      // Fade out after a few seconds
      setTimeout(() => {
        if (el) el.style.opacity = "0";
      }, 4000);
    }
  }

  // ── Check for duplicates silently ──
  async function checkDuplicate(company, title) {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const result = await chrome.runtime.sendMessage({
        type: "CHECK_DUPLICATE",
        payload: { company, title, date },
      });
      return result && result.isDuplicate;
    } catch {
      return false;
    }
  }

  // ══════════════════════════════════════════════
  // PUBLIC API — called by site-specific scripts
  // ══════════════════════════════════════════════

  /**
   * Show or update the floating widget with detected job data.
   * Call this whenever the user views a new job detail.
   * @param {{ company: string, title: string, source: string }} details
   */
  window.JobLog.updateJobWidget = function (details) {
    if (!details) return;

    const company = (details.company || "").trim();
    const title = (details.title || "").trim();
    const source = (details.source || "").trim();

    // Don't update if nothing useful was detected
    if (!company && !title) return;

    // Don't update if data hasn't changed AND widget is active in DOM
    if (
      company === currentData.company &&
      title === currentData.title &&
      source === currentData.source &&
      document.getElementById("joblog-widget")
    ) {
      return;
    }

    currentData = { company, title, source };
    isSaved = false;

    console.log("[JobLog] Detected job details:", company, "-", title, "(Source:", source + ")");

    // Create widget if it doesn't exist (user closed it, first detection, etc.)
    if (!widgetEl || !document.getElementById("joblog-widget")) {
      widgetEl = null; // reset ref if it was removed from DOM
      createWidget();
      // Allow DOM to render, then fill values
      requestAnimationFrame(() => {
        fillFields(company, title, source);
      });
    } else {
      fillFields(company, title, source);
      // If minimized, pulse the mini button to signal new data
      if (isMinimized) {
        const mini = document.getElementById("jl-mini-btn");
        if (mini) {
          mini.style.animation = "none";
          void mini.offsetWidth; // reflow
          mini.style.animation = "joblog-pulse 2s infinite";
        }
      }
    }
  };

  function fillFields(company, title, source) {
    const companyInput = document.getElementById("jl-company");
    const titleInput = document.getElementById("jl-title");
    const sourceEl = document.getElementById("jl-source");
    const saveBtn = document.getElementById("jl-save");
    const msgEl = document.getElementById("jl-msg");

    if (companyInput) companyInput.value = company;
    if (titleInput) titleInput.value = title;
    if (sourceEl) sourceEl.textContent = source;

    // Reset save button state
    if (saveBtn) {
      saveBtn.textContent = "Save Application ✓";
      saveBtn.classList.remove("jl-saved", "jl-duplicate");
    }
    if (msgEl) {
      msgEl.textContent = "";
      msgEl.style.opacity = "0";
    }

    // Check for duplicates in background
    if (company && title) {
      checkDuplicate(company, title).then((isDup) => {
        // Only apply if data hasn't changed since we started the check
        if (
          currentData.company === company &&
          currentData.title === title &&
          isDup
        ) {
          const btn = document.getElementById("jl-save");
          if (btn) {
            btn.textContent = "Already logged today";
            btn.classList.add("jl-duplicate");
          }
        }
      });
    }
  }

  // ── Message listener so popup.js can request current data ──
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "GET_JOB_DATA") {
      sendResponse({
        company: currentData.company,
        title: currentData.title,
        source: currentData.source,
      });
    }
  });
})();
