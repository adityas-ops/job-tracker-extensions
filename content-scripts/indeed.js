// Indeed content script — job detail detection with live updates
// Indeed uses a split-pane layout: job list on left, detail on right.
// When user clicks a different job, the right panel updates via AJAX.

(function () {
  let lastKey = "";

  // ── Scrape job details from the detail panel ──
  function scrapeJobDetails() {
    // Job title
    const titleEl =
      document.querySelector("h1.jobsearch-JobInfoHeader-title") ||
      document.querySelector("[data-testid='jobsearch-JobInfoHeader-title']") ||
      document.querySelector("h1[class*='jobTitle']") ||
      document.querySelector(".jobsearch-JobInfoHeader-title") ||
      document.querySelector("h2.jobTitle") ||
      document.querySelector("[data-testid='job-title']") ||
      document.querySelector(".jobsearch-ViewJobLayout h1");

    // Company name
    const companyEl =
      document.querySelector("[data-testid='inlineHeader-companyName'] a") ||
      document.querySelector("[data-testid='inlineHeader-companyName']") ||
      document.querySelector("[data-testid='companyInfo-name'] a") ||
      document.querySelector("[data-testid='companyInfo-name']") ||
      document.querySelector(".jobsearch-CompanyInfoContainer a") ||
      document.querySelector(".jobsearch-InlineCompanyRating .icl-u-lg-mr--sm") ||
      document.querySelector("[data-company-name='true']") ||
      document.querySelector("[class*='companyName'] a") ||
      document.querySelector("[class*='companyName']");

    let title = titleEl ? titleEl.textContent.trim() : "";
    const company = companyEl ? companyEl.textContent.trim() : "";

    // Strip "(X openings)" suffix from title
    title = title.replace(/\(.*?openings?\)/i, "").trim();

    return { title, company };
  }

  // ── Is a job detail visible? ──
  function isJobDetailVisible() {
    return (
      /indeed\.(com|co\.in)\/(viewjob|jobs|rc\/clk)\b/i.test(location.href) ||
      document.querySelector("h1.jobsearch-JobInfoHeader-title") !== null ||
      document.querySelector("[data-testid='jobsearch-JobInfoHeader-title']") !== null ||
      document.querySelector(".jobsearch-ViewJobLayout") !== null
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
      source: "Indeed",
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

    // URL change detection
    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastKey = "";
        setTimeout(tryUpdate, 500);
      }
    });
    urlObserver.observe(document, { childList: true, subtree: true });

    // Click on job cards in the list
    document.addEventListener("click", (e) => {
      const jobCard = e.target.closest(
        ".job_seen_beacon, " +
        ".jobsearch-ResultsList li, " +
        "[data-testid='job-result'], " +
        ".resultContent, " +
        ".tapItem, " +
        "a[data-jk]"
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
