// Glassdoor content script — job detail detection with live updates
// Key fix: all selectors scoped to the RIGHT detail panel to avoid matching
// the first job card in the left list panel.

(function () {
  let lastKey = "";
  let lastDetailText = "";

  // ── Find the detail panel (right column) ──
  function getDetailPanel() {
    return (
      // Glassdoor uses various containers for the right-side detail
      document.querySelector("[class*='JobDetails_jobDetailsContainer']") ||
      document.querySelector("[class*='jobDetailsContainer']") ||
      document.querySelector("[class*='RightColumn']") ||
      document.querySelector("[class*='rightColumn']") ||
      document.querySelector("[class*='TwoColumnLayout_right']") ||
      document.querySelector("[class*='JobDetail_jobDetail']") ||
      document.querySelector("[class*='job-detail-body']") ||
      document.querySelector("#JDCol") ||
      document.querySelector("[id*='JDCol']") ||
      // Try finding by the apply button's parent area
      document.querySelector("[data-test='applyButton']")?.closest("[class*='JobDetails']") ||
      document.querySelector("[data-test='apply-button']")?.closest("[class*='JobDetails']") ||
      // Generic: find the larger right pane
      document.querySelector("main") ||
      null
    );
  }

  // ── Scrape job details, scoped to detail panel ──
  function scrapeJobDetails() {
    let title = "";
    let company = "";

    const panel = getDetailPanel();
    const scope = panel || document;

    // ── Title: query within detail panel ──
    const titleSelectors = [
      "[data-test='job-title']",
      "h1[data-test='jobTitle']",
      "[class*='jobTitle']",
      "[class*='JobTitle']",
      ".JobDetails_jobTitle__Rw_gn",
      "h1",
    ];
    for (const sel of titleSelectors) {
      const el = scope.querySelector(sel);
      if (el && el.textContent.trim()) {
        title = el.textContent.trim();
        break;
      }
    }

    // ── Company: query within detail panel ──
    const companySelectors = [
      "[data-test='employer-name']",
      "[class*='employerName'] a",
      "[class*='employerName']",
      "[class*='EmployerName'] a",
      "[class*='EmployerName']",
      "[class*='EmployerProfile'] a",
      "[class*='employer'] a",
      "[class*='Employer'] a",
      ".css-87uc0g",
    ];
    for (const sel of companySelectors) {
      const el = scope.querySelector(sel);
      if (el && el.textContent.trim()) {
        company = el.textContent.trim();
        break;
      }
    }

    // ── If scoped search failed, try global but skip list items ──
    if (!title || !company) {
      // Find ALL matching elements and pick the one NOT inside a job card list
      if (!title) {
        const allTitles = document.querySelectorAll("[data-test='job-title'], h1[data-test='jobTitle'], [class*='jobTitle'] h1");
        for (const el of allTitles) {
          // Skip if inside a list/card container
          if (el.closest("[class*='JobsList']") || el.closest("[class*='jobsList']") || el.closest("ul")) continue;
          if (el.textContent.trim()) {
            title = el.textContent.trim();
            break;
          }
        }
      }
      if (!company) {
        const allCompanies = document.querySelectorAll("[data-test='employer-name'], [class*='employerName'], [class*='EmployerName']");
        for (const el of allCompanies) {
          if (el.closest("[class*='JobsList']") || el.closest("[class*='jobsList']") || el.closest("ul")) continue;
          if (el.textContent.trim()) {
            company = el.textContent.trim();
            break;
          }
        }
      }
    }

    // Clean company — strip rating stars like "AppZoy 4.0★"
    company = company
      .replace(/\s*[\d.]+\s*★?\s*$/, "")
      .replace(/\s*\d+\.\d+\s*$/, "")
      .trim();

    return { title, company };
  }

  // ── Get text content of detail panel for change detection ──
  function getDetailText() {
    const panel = getDetailPanel();
    if (!panel) return "";
    // Use first 300 chars as fingerprint
    return (panel.textContent || "").substring(0, 300).trim();
  }

  // ── Is a job detail visible? ──
  function isJobDetailVisible() {
    return (
      /glassdoor\.(com|co\.in)\/(job-listing|Jobs|Job|partner\/jobListing)\//i.test(location.href) ||
      /glassdoor\.(com|co\.in)\/job\//i.test(location.href) ||
      document.querySelector("[data-test='job-title']") !== null ||
      document.querySelector("[class*='jobTitle']") !== null ||
      document.querySelector("[class*='JobTitle']") !== null
    );
  }

  // ── Try to update the widget ──
  function tryUpdate() {
    if (!isJobDetailVisible()) return;

    const { title, company } = scrapeJobDetails();
    if (!title && !company) return;

    const key = `${company}|${title}`;
    if (key === lastKey) return;
    lastKey = key;

    window.JobLog.updateJobWidget({
      company,
      title,
      source: "Glassdoor",
    });
  }

  // ── Check if detail panel content has changed ──
  function checkForChanges() {
    const currentText = getDetailText();
    if (currentText && currentText !== lastDetailText) {
      lastDetailText = currentText;
      lastKey = ""; // Content changed, force re-scrape
      tryUpdate();
    }
  }

  // ── Start observing ──
  function startObserving() {
    const target = document.body;
    if (!target) {
      document.addEventListener("DOMContentLoaded", startObserving);
      return;
    }

    let debounceTimer = null;
    const debouncedCheck = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkForChanges, 350);
    };

    const observer = new MutationObserver(debouncedCheck);
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // URL change detection
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastKey = "";
        lastDetailText = "";
        setTimeout(tryUpdate, 500);
        setTimeout(tryUpdate, 1200);
      }
    }, 800);

    // Click anywhere — very broad, then check after delay
    document.addEventListener("click", () => {
      // After any click, check for content changes after renders complete
      setTimeout(checkForChanges, 400);
      setTimeout(checkForChanges, 900);
      setTimeout(checkForChanges, 1800);
    }, true);

    // Periodic check every 2s as ultimate fallback
    setInterval(checkForChanges, 2000);
  }

  // ── Initial run ──
  if (document.readyState === "complete" || document.readyState === "interactive") {
    lastDetailText = getDetailText();
    tryUpdate();
    startObserving();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      lastDetailText = getDetailText();
      tryUpdate();
      startObserving();
    });
  }

  setTimeout(tryUpdate, 1000);
  setTimeout(tryUpdate, 2000);
  setTimeout(tryUpdate, 4000);
})();
