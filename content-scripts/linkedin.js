// LinkedIn content script — job detail detection with live updates
// Scopes queries to the detail panel container with multi-strategy fallbacks.

(function () {
  let lastKey = "";

  // Blacklist of invalid strings for titles and companies
  const INVALID_TITLES = [
    "top job picks for you",
    "top job picks",
    "javascript developer jobs",
    "job search",
    "recent job searches",
    "recommended for you",
    "explore jobs",
    "alert on",
    "your ai-powered job assessment",
    "see how you compare",
    "meet the hiring team",
    "about the job",
    "exclusive job seeker insights"
  ];

  const INVALID_COMPANIES = [
    "microsoft azure",
    "easy apply",
    "apply",
    "save",
    "share",
    "promoted",
    "actively reviewing",
    "top job picks",
    "company logo",
    "linkedin"
  ];

  function isInvalidTitle(title) {
    if (!title || title.length < 2 || title.length > 150) return true;
    const lower = title.toLowerCase();
    return INVALID_TITLES.some((inv) => lower.includes(inv));
  }

  function isInvalidCompany(company) {
    if (!company || company.length < 2 || company.length > 80) return true;
    const lower = company.toLowerCase();
    return INVALID_COMPANIES.some((inv) => lower === inv);
  }

  // ── Find the detail panel container ──
  function getDetailPanel() {
    return (
      document.querySelector(".jobs-search__job-details--container") ||
      document.querySelector(".jobs-search__job-details--wrapper") ||
      document.querySelector(".jobs-semantic-search-job-details-wrapper") ||
      document.querySelector(".job-view-layout") ||
      document.querySelector(".jobs-details__main-content") ||
      document.querySelector(".scaffold-layout__detail") ||
      document.querySelector(".jobs-search__job-details") ||
      document.querySelector(".jobs-details") ||
      document.querySelector("[class*='jobs-search__job-details']") ||
      document.querySelector("[class*='scaffold-layout__detail']") ||
      document.querySelector(".decorated-job-posting__details") ||
      document.querySelector(".artdeco-modal[role='dialog']") ||
      document.querySelector("[class*='jobDetails']") ||
      document.querySelector("[class*='job-details']") ||
      document.querySelector(".jobs-unified-top-card") ||
      document.querySelector(".job-details-jobs-unified-top-card") ||
      document.querySelector("main")
    );
  }

  // Helper to extract company name from panel's top card
  function scrapeCompanyFromTopCard(panel) {
    const companySelectors = [
      ".job-details-jobs-unified-top-card__company-name a",
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a",
      ".jobs-unified-top-card__company-name",
      ".topcard__org-name-link",
      ".top-card-layout__first-sub-heading a",
      ".top-card-layout__first-sub-heading",
      ".job-details-jobs-unified-top-card__primary-description-container a",
      ".artdeco-entity-lockup__subtitle a",
      ".artdeco-entity-lockup__subtitle"
    ];

    for (const sel of companySelectors) {
      const el = panel.querySelector(sel);
      if (el && el.textContent.trim()) {
        let raw = el.textContent.trim();
        raw = raw.replace(/logo$/i, "").split("·")[0].split("•")[0].split("\n")[0].trim();
        if (!isInvalidCompany(raw)) {
          return raw;
        }
      }
    }

    const companyLinks = panel.querySelectorAll('a[href*="/company/"]');
    for (const link of companyLinks) {
      let text = link.textContent.trim();
      if (text && !text.includes("http") && !text.toLowerCase().includes("see all")) {
        text = text.replace(/logo$/i, "").split("·")[0].split("•")[0].split("\n")[0].trim();
        if (!isInvalidCompany(text)) {
          return text;
        }
      }
    }

    return "";
  }

  // ── Scrape job details from the detail panel ──
  function scrapeJobDetails() {
    let title = "";
    let company = "";

    const panel = getDetailPanel();
    if (!panel) return { title: "", company: "" };

    // ── STRATEGY 1: Parse from Apply / Save buttons in detail panel (100% reliable) ──
    const actionButtons = panel.querySelectorAll(
      'button[aria-label*="Apply"], ' +
      'button[aria-label*="Save"], ' +
      '.jobs-save-button, ' +
      '.jobs-apply-button, ' +
      '[data-job-id]'
    );

    for (const btn of actionButtons) {
      const textsToTest = [
        btn.getAttribute("aria-label") || "",
        btn.getAttribute("title") || "",
        btn.querySelector(".a11y-text")?.textContent || "",
        btn.querySelector(".jobs-save-button__text")?.textContent || ""
      ];

      for (const text of textsToTest) {
        if (!text) continue;

        // Pattern: "(Easy )Apply ... to [TITLE] (at [COMPANY] | on company website)"
        const applyMatch = text.match(/(?:Easy\s+)?Apply(?:\s+on\s+[^\s]+(?:\s+[^\s]+)?)?\s+to\s+(.+?)(?:\s+at\s+(.+))?$/i);
        if (applyMatch) {
          const candidateTitle = applyMatch[1]
            .trim()
            .replace(/\s+on\s+company\s+website$/i, "")
            .replace(/\s+externally$/i, "");
          let candidateCompany = applyMatch[2] ? applyMatch[2].trim() : "";
          if (!candidateCompany) {
            candidateCompany = scrapeCompanyFromTopCard(panel);
          }
          if (!isInvalidTitle(candidateTitle) && !isInvalidCompany(candidateCompany)) {
            return { title: candidateTitle, company: candidateCompany };
          }
        }

        // Pattern: "Save [TITLE] at [COMPANY]"
        const saveMatch = text.match(/Save\s+(.+?)(?:\s+at\s+(.+))?$/i);
        if (saveMatch) {
          const candidateTitle = saveMatch[1].trim();
          let candidateCompany = saveMatch[2] ? saveMatch[2].trim() : "";
          if (!candidateCompany) {
            candidateCompany = scrapeCompanyFromTopCard(panel);
          }
          if (!isInvalidTitle(candidateTitle) && !isInvalidCompany(candidateCompany)) {
            return { title: candidateTitle, company: candidateCompany };
          }
        }
      }
    }

    // ── STRATEGY 2: Scoped Top Card Elements ──
    const topCard =
      panel.querySelector(".job-details-jobs-unified-top-card__container--two-pane") ||
      panel.querySelector(".job-details-jobs-unified-top-card") ||
      panel.querySelector(".jobs-unified-top-card") ||
      panel.querySelector(".job-view-layout") ||
      panel.querySelector(".jobs-details__main-content") ||
      panel;

    // 1. Company from Top Card
    company = scrapeCompanyFromTopCard(topCard);

    // 2. Title from Top Card
    const titleSelectors = [
      "h1.job-details-jobs-unified-top-card__job-title",
      ".job-details-jobs-unified-top-card__job-title h1 a",
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title a",
      ".job-details-jobs-unified-top-card__job-title",
      "h1.jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title h1",
      ".jobs-unified-top-card__job-title",
      "h1.top-card-layout__title",
      "h1.topcard__title",
      ".artdeco-entity-lockup__title h1",
      ".artdeco-entity-lockup__title",
      "a[href*='/jobs/view/']",
      "h1.t-24",
      "h1.t-24.t-bold",
      "h1.t-18",
      "h2.t-16",
      "h2.t-24"
    ];

    for (const sel of titleSelectors) {
      const el = topCard.querySelector(sel);
      if (el && el.textContent.trim()) {
        const raw = el.textContent.trim();
        if (!isInvalidTitle(raw)) {
          title = raw;
          break;
        }
      }
    }

    // ── STRATEGY 3: Standalone /jobs/view/ URL document.title Fallback ONLY ──
    if ((!title || !company) && location.href.includes("/jobs/view/")) {
      const docTitle = (document.title || "")
        .replace(/^\(\d+\)\s*/, "")
        .replace(/\s*\|\s*LinkedIn$/i, "")
        .replace(/\s*-\s*LinkedIn$/i, "")
        .trim();

      if (!company && docTitle) {
        const atMatch = docTitle.match(/\bat\s+(.+?)(?:\s+in\s+|\s*$)/i);
        if (atMatch && !isInvalidCompany(atMatch[1].trim())) {
          company = atMatch[1].trim();
        }
      }

      if (!title && docTitle) {
        if (docTitle.includes(" at ")) {
          const candidate = docTitle.split(/\bat\s+/i)[0].trim();
          if (!isInvalidTitle(candidate)) title = candidate;
        }
      }
    }

    // Final cleanup
    if (company) {
      company = company
        .replace(/\s+/g, " ")
        .replace(/actively reviewing.*/i, "")
        .replace(/promoted.*/i, "")
        .trim();
    }

    if (title) {
      title = title.replace(/\s+/g, " ").trim();
    }

    return { title, company };
  }

  // ── Is this a page where job details should be visible? ──
  function isJobDetailVisible() {
    const href = location.href;
    return (
      /linkedin\.com\/jobs/i.test(href) ||
      /currentJobId=/i.test(href) ||
      getDetailPanel() !== null
    );
  }

  // ── Try to update the widget ──
  function tryUpdate() {
    if (!isJobDetailVisible()) return;

    const { title, company } = scrapeJobDetails();
    if (!title && !company) return;

    const key = `${company}|${title}`;
    // If widget exists in DOM and data hasn't changed, skip
    if (key === lastKey && document.getElementById("joblog-widget")) return;
    lastKey = key;

    if (window.JobLog && typeof window.JobLog.updateJobWidget === "function") {
      window.JobLog.updateJobWidget({
        company,
        title,
        source: "LinkedIn",
      });
    }
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
      debounceTimer = setTimeout(tryUpdate, 300);
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
        setTimeout(tryUpdate, 300);
        setTimeout(tryUpdate, 1000);
        setTimeout(tryUpdate, 2000);
      }
    }, 400);

    // Click on job cards in the list panel
    document.addEventListener(
      "click",
      (e) => {
        const jobCard = e.target.closest(
          ".jobs-search-results__list-item, " +
            ".job-card-container, " +
            "[data-occludable-job-id], " +
            ".scaffold-layout__list-item, " +
            ".jobs-search-results-list__list-item, " +
            ".job-card-list__entity-lockup, " +
            "li[class*='jobs-search'], " +
            "[class*='job-card'], " +
            "[class*='JobCard'], " +
            "a[href*='/jobs/view/']"
        );
        if (jobCard) {
          lastKey = "";
          setTimeout(tryUpdate, 400);
          setTimeout(tryUpdate, 1200);
          setTimeout(tryUpdate, 2500);
        }
      },
      true
    );
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
