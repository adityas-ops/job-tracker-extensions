// LinkedIn content script — job detail detection with live updates
// Key approach: scope all queries to the DETAIL PANEL container,
// use a[href*="/company/"] for company name (most stable selector on LinkedIn).

(function () {
  let lastKey = "";

  // ── Find the detail panel container ──
  function getDetailPanel() {
    return (
      document.querySelector(".scaffold-layout__detail") ||
      document.querySelector(".jobs-search__job-details") ||
      document.querySelector(".jobs-details") ||
      document.querySelector("[class*='jobs-search__job-details']") ||
      document.querySelector("[class*='scaffold-layout__detail']") ||
      // Fallback: the right-side content area
      document.querySelector(".jobs-details__main-content") ||
      document.querySelector("[class*='jobDetails']")
    );
  }

  // ── Scrape job details from the detail panel ──
  function scrapeJobDetails() {
    let title = "";
    let company = "";

    const panel = getDetailPanel();

    // ── Strategy 1: Scoped to detail panel ──
    if (panel) {
      // Company: find <a> linking to a company page (most reliable LinkedIn selector)
      const companyLink = panel.querySelector('a[href*="/company/"]');
      if (companyLink) {
        company = companyLink.textContent.trim();
      }

      // Company fallbacks within the panel
      if (!company) {
        const companySelectors = [
          ".job-details-jobs-unified-top-card__company-name a",
          ".job-details-jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name a",
          ".jobs-unified-top-card__company-name",
          ".job-details-jobs-unified-top-card__primary-description-container a",
          ".artdeco-entity-lockup__subtitle a",
          ".artdeco-entity-lockup__subtitle",
        ];
        for (const sel of companySelectors) {
          const el = panel.querySelector(sel);
          if (el && el.textContent.trim()) {
            const text = el.textContent.trim();
            // Filter out non-company text (location, metadata, etc.)
            if (text.length < 80 && !text.includes("applicant") && !text.includes("·")) {
              company = text;
              break;
            }
          }
        }
      }

      // Title: h1 or h2 inside detail panel
      const titleSelectors = [
        "h1",
        "h2.t-24",
        ".job-details-jobs-unified-top-card__job-title h1",
        ".job-details-jobs-unified-top-card__job-title a",
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title h1",
        ".jobs-unified-top-card__job-title",
        ".artdeco-entity-lockup__title h1",
        ".t-24.t-bold",
      ];
      for (const sel of titleSelectors) {
        const el = panel.querySelector(sel);
        if (el && el.textContent.trim()) {
          title = el.textContent.trim();
          break;
        }
      }
    }

    // ── Strategy 2: Global selectors (if panel not found) ──
    if (!title) {
      const globalTitleSelectors = [
        ".job-details-jobs-unified-top-card__job-title h1",
        ".jobs-unified-top-card__job-title h1",
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
      ];
      for (const sel of globalTitleSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          title = el.textContent.trim();
          break;
        }
      }
    }

    if (!company) {
      // Try global company link
      const globalCompanyLink = document.querySelector(
        '.job-details-jobs-unified-top-card__company-name a[href*="/company/"]'
      );
      if (globalCompanyLink) {
        company = globalCompanyLink.textContent.trim();
      }
    }

    // ── Strategy 3: document.title fallback (ONLY "at" pattern, NOT dash) ──
    if (!company) {
      const docTitle = (document.title || "").replace(/^\(\d+\)\s*/, "");
      // Pattern: "Job Title at Company | LinkedIn"
      const atMatch = docTitle.match(/\bat\s+(.+?)\s*\|/i);
      if (atMatch) {
        company = atMatch[1].trim();
      }
    }

    // Clean company — remove noise
    company = company
      .replace(/\s+/g, " ")
      .replace(/actively reviewing.*/i, "")
      .replace(/\s*·\s*$/, "")
      .trim();

    return { title, company };
  }

  // ── Is this a page where job details should be visible? ──
  function isJobDetailVisible() {
    const href = location.href;
    return (
      /linkedin\.com\/jobs\/(view|collections|search)/i.test(href) ||
      /linkedin\.com\/jobs\/.*currentJobId/i.test(href) ||
      getDetailPanel() !== null
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
      source: "LinkedIn",
    });
  }

  // ── Watch for SPA navigation and DOM changes ──
  function startObserving() {
    const target = document.body;
    if (!target) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", startObserving);
      } else {
        setTimeout(startObserving, 100);
      }
      return;
    }

    let debounceTimer = null;
    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(tryUpdate, 400);
    };

    const observer = new MutationObserver(debouncedUpdate);
    observer.observe(target, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    // URL change polling (LinkedIn doesn't always fire popstate)
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastKey = "";
        setTimeout(tryUpdate, 500);
        setTimeout(tryUpdate, 1200);
        setTimeout(tryUpdate, 2500);
      }
    }, 600);

    // Click on job cards in the list panel
    document.addEventListener("click", (e) => {
      const jobCard = e.target.closest(
        ".jobs-search-results__list-item, " +
        ".job-card-container, " +
        "[data-occludable-job-id], " +
        ".scaffold-layout__list-item, " +
        ".jobs-search-results-list__list-item, " +
        ".job-card-list__entity-lockup, " +
        "li[class*='jobs-search'], " +
        "[class*='job-card'], " +
        "[class*='JobCard']"
      );
      if (jobCard) {
        lastKey = "";
        setTimeout(tryUpdate, 600);
        setTimeout(tryUpdate, 1500);
        setTimeout(tryUpdate, 3000);
      }
    }, true);
  }

  // ── Bootstrap ──
  function init() {
    tryUpdate();
    startObserving();
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }

  // Aggressive retries for LinkedIn's lazy rendering
  setTimeout(tryUpdate, 1000);
  setTimeout(tryUpdate, 2000);
  setTimeout(tryUpdate, 3500);
  setTimeout(tryUpdate, 5000);
  setTimeout(tryUpdate, 8000);
})();
