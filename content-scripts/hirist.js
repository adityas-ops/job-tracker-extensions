// Hirist.tech content script — job detail detection with live updates
// Key fix: Extract company from the info line "Company · Experience · Location"
// below the h1, then strip the company prefix from the h1 to get clean title.
// e.g. h1="Practo - React Native Developer - iOS/Android" → title="React Native Developer - iOS/Android"

(function () {
  let lastKey = "";

  // ── Scrape job details ──
  function scrapeJobDetails() {
    let title = "";
    let company = "";

    // ── Step 1: Find the h1 (raw title, may include company prefix) ──
    const titleSelectors = [
      ".job-header h1",
      ".job-title",
      ".job-detail-header h1",
      ".job-desc-header h1",
      ".jd-title",
      "h1[class*='title']",
      "h1",
    ];
    let rawTitle = "";
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        rawTitle = el.textContent.trim();
        break;
      }
    }

    // ── Step 2: Find company from the info line "Company · Experience · Location" ──

    // Strategy A: Find elements with "·" separator near/after the title
    const allTextEls = document.querySelectorAll("h1, h2, h3, span, div, p, a");
    for (const el of allTextEls) {
      const text = el.textContent.trim();

      // Skip the h1 itself, skip long blocks of text
      if (text === rawTitle) continue;
      if (text.length > 200) continue;
      if (el.tagName === "H1") continue;

      // Look for "Company · X Years · City" pattern
      if (text.includes("·") || text.includes("•")) {
        const sep = text.includes("·") ? "·" : "•";
        const parts = text.split(sep).map(s => s.trim());
        // First part should be company name (short, no digits like "3-6 Years")
        if (parts.length >= 2 && parts[0].length > 1 && parts[0].length < 60) {
          // Verify it's not experience/location (shouldn't contain "years", "yrs", etc.)
          if (!/\d+\s*[-–]\s*\d+\s*(years?|yrs?)/i.test(parts[0]) &&
              !/remote|hybrid|on-?site/i.test(parts[0])) {
            company = parts[0];
            break;
          }
        }
      }
    }

    // Strategy B: Direct selectors for company
    if (!company) {
      const companySelectors = [
        ".company-name a",
        ".company-name",
        ".job-company",
        ".company_name",
        ".comp-name a",
        ".comp-name",
        "[class*='companyName'] a",
        "[class*='companyName']",
        "[class*='company-name'] a",
        "[class*='company-name']",
        ".jd-company-name",
        ".jd-header-comp-name",
      ];
      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          company = el.textContent.trim();
          break;
        }
      }
    }

    // Strategy C: "Posted by" / recruiter section — "HR at Practo"
    if (!company) {
      const body = document.body.textContent || "";
      const recruiterMatch = body.match(/(?:recruiter|hr|talent)\s+at\s+([^\n,]+)/i);
      if (recruiterMatch) {
        const candidate = recruiterMatch[1].trim().split("\n")[0].trim();
        if (candidate.length > 1 && candidate.length < 60) {
          company = candidate;
        }
      }
    }

    // ── Step 3: Clean up the title ──
    title = rawTitle;

    // If we found company and the title starts with "Company - ", strip it
    if (company && title) {
      // Check for patterns: "Company - Title" or "Company – Title" or "Company : Title"
      const prefix = company + " - ";
      const prefix2 = company + " – ";
      const prefix3 = company + " : ";

      if (title.startsWith(prefix)) {
        title = title.substring(prefix.length).trim();
      } else if (title.startsWith(prefix2)) {
        title = title.substring(prefix2.length).trim();
      } else if (title.startsWith(prefix3)) {
        title = title.substring(prefix3.length).trim();
      } else {
        // Case-insensitive check
        const lowerTitle = title.toLowerCase();
        const lowerCompany = company.toLowerCase();
        if (lowerTitle.startsWith(lowerCompany + " - ")) {
          title = title.substring(company.length + 3).trim();
        } else if (lowerTitle.startsWith(lowerCompany + " – ")) {
          title = title.substring(company.length + 3).trim();
        }
      }
    }

    return { title, company };
  }

  // ── Is this a job detail page? ──
  function isJobDetailVisible() {
    return (
      /hirist\.(tech|com)\/.+/i.test(location.href) &&
      (document.querySelector(".job-header") !== null ||
       document.querySelector(".job-title") !== null ||
       document.querySelector("[class*='job-header']") !== null ||
       document.querySelector("h1") !== null)
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
      source: "Hirist",
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
    observer.observe(target, { childList: true, subtree: true, characterData: true });

    // URL change detection
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        lastKey = "";
        setTimeout(tryUpdate, 500);
        setTimeout(tryUpdate, 1200);
      }
    }, 1000);

    // Click on job cards
    document.addEventListener("click", (e) => {
      const jobCard = e.target.closest(
        ".job-card, [class*='job-card'], [class*='jobCard'], a[href*='/job/'], a[href*='/jobs/']"
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
