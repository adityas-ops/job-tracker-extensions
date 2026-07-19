// Naukri content script — job detail detection with live updates
// Detects when user is viewing a job listing and scrapes company + title.

(function () {
  let lastKey = "";

  // ── Scrape job details ──
  function scrapeJobDetails() {
    // Job title
    const titleEl =
      document.querySelector(".jd-header-title") ||
      document.querySelector("h1.jd-header-title") ||
      document.querySelector("[class*='jd-header'] h1") ||
      document.querySelector(".styles_jd-header-title__rZwM1") ||
      document.querySelector("h1[class*='title']") ||
      document.querySelector(".job-title") ||
      document.querySelector("h1");

    // Company name
    const companyEl =
      document.querySelector(".jd-header-comp-name a") ||
      document.querySelector(".jd-header-comp-name") ||
      document.querySelector("[class*='jd-header-comp-name'] a") ||
      document.querySelector("[class*='comp-name'] a") ||
      document.querySelector(".company-name a") ||
      document.querySelector(".company-name") ||
      document.querySelector("[class*='companyName']");

    const title = titleEl ? titleEl.textContent.trim() : "";
    const company = companyEl ? companyEl.textContent.trim() : "";

    return { title, company };
  }

  // ── Is this a job detail page? ──
  function isJobDetailVisible() {
    return (
      /naukri\.com\/(job-listings|job-detail|.*-jid-)/i.test(location.href) ||
      document.querySelector(".jd-header-title") !== null ||
      document.querySelector("[class*='jd-header']") !== null ||
      document.querySelector(".styles_jd-header-title__rZwM1") !== null
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
      source: "Naukri",
    });
  }

  // ── Observe DOM changes ──
  function startObserving() {
    const target = document.body;
    if (!target) {
      document.addEventListener("DOMContentLoaded", startObserving);
      return;
    }

    let debounceTimer = null;
    const debouncedUpdate = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(tryUpdate, 300);
    };

    const observer = new MutationObserver(debouncedUpdate);
    observer.observe(target, { childList: true, subtree: true });

    // URL change detection (Naukri uses some SPA-like navigation)
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastKey = "";
        setTimeout(tryUpdate, 500);
      }
    }, 1000);

    // Click on job cards
    document.addEventListener("click", (e) => {
      const jobCard = e.target.closest(
        ".jobTuple, " +
        "[class*='jobTuple'], " +
        ".srp-jobtuple, " +
        ".cust-job-tuple, " +
        "article[data-job-id], " +
        "[class*='JobTuple']"
      );
      if (jobCard) {
        lastKey = "";
        setTimeout(tryUpdate, 500);
        setTimeout(tryUpdate, 1200);
      }
    }, true);
  }

  // ── Initial run ──
  if (document.readyState === "complete" || document.readyState === "interactive") {
    tryUpdate();
    startObserving();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      tryUpdate();
      startObserving();
    });
  }

  setTimeout(tryUpdate, 1500);
  setTimeout(tryUpdate, 3000);
})();
