document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("date").value = new Date().toISOString().slice(0, 10);

  // ── Pre-fill from active tab's content script ──
  chrome.runtime.sendMessage({ type: "GET_JOB_DATA_FROM_TAB" }, (response) => {
    if (chrome.runtime.lastError || !response) return;
    if (response.company) {
      document.getElementById("company").value = response.company;
    }
    if (response.title) {
      document.getElementById("title").value = response.title;
    }
    if (response.source) {
      const sourceSelect = document.getElementById("source");
      // Find matching option
      for (let i = 0; i < sourceSelect.options.length; i++) {
        if (sourceSelect.options[i].text === response.source) {
          sourceSelect.selectedIndex = i;
          break;
        }
      }
    }
  });

  document.getElementById("save").addEventListener("click", async () => {
    const company = document.getElementById("company").value.trim();
    const title   = document.getElementById("title").value.trim();
    const source  = document.getElementById("source").value;
    const date    = document.getElementById("date").value;

    if (!company || !title || !date) {
      alert("Please fill in company, job title, and date.");
      return;
    }

    const entry = {
      id: crypto.randomUUID(),
      company, title, source, date,
      status: "Applied",
      heardBack: false,
      heardBackDate: null,
      notes: "",
    };

    const result = await chrome.runtime.sendMessage({
      type: "ADD_APPLICATION",
      payload: entry,
    });

    const confirm = document.getElementById("confirm");
    if (result.success) {
      confirm.textContent = "Saved successfully ✓";
      confirm.style.color = "#6FCF97";
      document.getElementById("company").value = "";
      document.getElementById("title").value = "";
    } else {
      confirm.textContent = "Already logged today for this role.";
      confirm.style.color = "#F2C94C";
    }
    confirm.style.display = "block";
    setTimeout(() => (confirm.style.display = "none"), 2000);
  });

  document.getElementById("openDashboard").addEventListener("click", () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("dashboard/dashboard.html"),
    });
  });
});
