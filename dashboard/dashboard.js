let applications = [];
let editingId = null;

const els = {
  rangeFilter: document.getElementById("rangeFilter"),
  sourceFilter: document.getElementById("sourceFilter"),
  companyFilter: document.getElementById("companyFilter"),
  tableBody: document.getElementById("tableBody"),
  emptyState: document.getElementById("emptyState"),
  statTotal: document.getElementById("statTotal"),
  statWeek: document.getElementById("statWeek"),
  statMonth: document.getElementById("statMonth"),
  statResponse: document.getElementById("statResponse"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalTitle: document.getElementById("modalTitle"),
  mCompany: document.getElementById("mCompany"),
  mTitle: document.getElementById("mTitle"),
  mSource: document.getElementById("mSource"),
  mDate: document.getElementById("mDate"),
  mStatus: document.getElementById("mStatus"),
  mHeardBack: document.getElementById("mHeardBack"),
};

async function loadApplications() {
  const { applications: stored = [] } = await chrome.storage.local.get(
    "applications"
  );
  applications = stored.sort((a, b) => (a.date < b.date ? 1 : -1));
  populateSourceFilter();
  render();
}

function populateSourceFilter() {
  const sources = [...new Set(applications.map((a) => a.source))].sort();
  const current = els.sourceFilter.value;
  els.sourceFilter.innerHTML =
    '<option value="all">All sources</option>' +
    sources.map((s) => `<option value="${s}">${s}</option>`).join("");
  els.sourceFilter.value = sources.includes(current) ? current : "all";
}

function isInRange(dateStr, range) {
  if (range === "all") return true;
  const date = new Date(dateStr + "T00:00:00");
  const now = new Date();

  if (range === "day") {
    return date.toDateString() === now.toDateString();
  }
  if (range === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return date >= start;
  }
  if (range === "month") {
    return (
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()
    );
  }
  if (range === "year") {
    return date.getFullYear() === now.getFullYear();
  }
  return true;
}

function getFiltered() {
  const range = els.rangeFilter.value;
  const source = els.sourceFilter.value;
  const company = els.companyFilter.value.trim().toLowerCase();

  return applications.filter((a) => {
    if (!isInRange(a.date, range)) return false;
    if (source !== "all" && a.source !== source) return false;
    if (company && !a.company.toLowerCase().includes(company)) return false;
    return true;
  });
}

function computeStats(filtered) {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const thisWeek = applications.filter(
    (a) => new Date(a.date + "T00:00:00") >= weekStart
  ).length;

  const thisMonth = applications.filter((a) => {
    const d = new Date(a.date + "T00:00:00");
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const heardBackCount = filtered.filter((a) => a.heardBack).length;
  const responseRate = filtered.length
    ? Math.round((heardBackCount / filtered.length) * 100)
    : 0;

  els.statTotal.textContent = filtered.length;
  els.statWeek.textContent = thisWeek;
  els.statMonth.textContent = thisMonth;
  els.statResponse.textContent = `${responseRate}%`;
}

function badgeClass(status) {
  const map = {
    Applied: "badge-applied",
    Interviewing: "badge-interviewing",
    Offer: "badge-offer",
    Rejected: "badge-rejected",
    Ghosted: "badge-ghosted",
  };
  return map[status] || "badge-applied";
}

function render() {
  const filtered = getFiltered();
  computeStats(filtered);

  if (filtered.length === 0) {
    els.tableBody.innerHTML = "";
    els.emptyState.style.display = "block";
    return;
  }
  els.emptyState.style.display = "none";

  els.tableBody.innerHTML = filtered
    .map(
      (a) => `
    <tr data-id="${a.id}">
      <td>${formatDate(a.date)}</td>
      <td>${escapeHtml(a.company)}</td>
      <td>${escapeHtml(a.title)}</td>
      <td>${escapeHtml(a.source)}</td>
      <td><span class="badge ${badgeClass(a.status)}">${a.status}</span></td>
      <td class="${a.heardBack ? "heard-yes" : "heard-no"}">${
        a.heardBack ? "Yes" : "No"
      }</td>
      <td>
        <button class="delete-btn" data-action="edit">Edit</button>
        <button class="delete-btn" data-action="delete">✕</button>
      </td>
    </tr>
  `
    )
    .join("");

  els.tableBody.querySelectorAll("[data-action='delete']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      deleteApplication(id);
    });
  });

  els.tableBody.querySelectorAll("[data-action='edit']").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = e.target.closest("tr").dataset.id;
      openModal(id);
    });
  });
}

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function deleteApplication(id) {
  applications = applications.filter((a) => a.id !== id);
  await chrome.storage.local.set({ applications });
  render();
}

function openModal(id = null) {
  editingId = id;
  if (id) {
    const app = applications.find((a) => a.id === id);
    els.modalTitle.textContent = "Edit application";
    els.mCompany.value = app.company;
    els.mTitle.value = app.title;
    els.mSource.value = app.source;
    els.mDate.value = app.date;
    els.mStatus.value = app.status;
    els.mHeardBack.checked = app.heardBack;
  } else {
    els.modalTitle.textContent = "Add application";
    els.mCompany.value = "";
    els.mTitle.value = "";
    els.mSource.value = "LinkedIn";
    els.mDate.value = new Date().toISOString().slice(0, 10);
    els.mStatus.value = "Applied";
    els.mHeardBack.checked = false;
  }
  els.modalBackdrop.classList.add("open");
}

function closeModal() {
  els.modalBackdrop.classList.remove("open");
  editingId = null;
}

async function saveModal() {
  const company = els.mCompany.value.trim();
  const title = els.mTitle.value.trim();
  const date = els.mDate.value;

  if (!company || !title || !date) {
    alert("Please fill in company, job title, and date.");
    return;
  }

  if (editingId) {
    const app = applications.find((a) => a.id === editingId);
    app.company = company;
    app.title = title;
    app.source = els.mSource.value;
    app.date = date;
    app.status = els.mStatus.value;
    app.heardBack = els.mHeardBack.checked;
  } else {
    applications.push({
      id: crypto.randomUUID(),
      company,
      title,
      source: els.mSource.value,
      date,
      status: els.mStatus.value,
      heardBack: els.mHeardBack.checked,
      heardBackDate: null,
      notes: "",
    });
  }

  await chrome.storage.local.set({ applications });
  populateSourceFilter();
  closeModal();
  render();
}

function exportPDF() {
  const filtered = getFiltered();
  const range = els.rangeFilter.options[els.rangeFilter.selectedIndex].text;

  const printWindow = window.open("", "_blank");
  const rows = filtered
    .map(
      (a) => `
    <tr>
      <td>${formatDate(a.date)}</td>
      <td>${escapeHtml(a.company)}</td>
      <td>${escapeHtml(a.title)}</td>
      <td>${escapeHtml(a.source)}</td>
      <td>${a.status}</td>
      <td>${a.heardBack ? "Yes" : "No"}</td>
    </tr>
  `
    )
    .join("");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Job Applications - ${range}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p.meta { color: #555; font-size: 12px; margin-top: 0; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px 10px; font-size: 12px; text-align: left; }
        th { background: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>Job Application History</h1>
      <p class="meta">Range: ${range} — ${filtered.length} applications — generated ${new Date().toLocaleDateString()}</p>
      <table>
        <thead>
          <tr><th>Date</th><th>Company</th><th>Role</th><th>Source</th><th>Status</th><th>Heard back</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
}

// Event listeners
els.rangeFilter.addEventListener("change", render);
els.sourceFilter.addEventListener("change", render);
els.companyFilter.addEventListener("input", render);
document.getElementById("addBtn").addEventListener("click", () => openModal());
document.getElementById("exportBtn").addEventListener("click", exportPDF);
document.getElementById("modalCancel").addEventListener("click", closeModal);
document.getElementById("modalSave").addEventListener("click", saveModal);
els.modalBackdrop.addEventListener("click", (e) => {
  if (e.target === els.modalBackdrop) closeModal();
});

// React to storage changes made from the popup while dashboard is open
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.applications) {
    loadApplications();
  }
});

loadApplications();
