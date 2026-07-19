// Background service worker
// Handles storage read/write, badge updates, and job data relay

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ADD_APPLICATION") {
    addApplication(message.payload).then((result) => {
      sendResponse(result);
    });
    return true;
  }
  if (message.type === "CHECK_DUPLICATE") {
    checkDuplicate(message.payload).then((isDuplicate) => {
      sendResponse({ isDuplicate });
    });
    return true;
  }
  if (message.type === "GET_JOB_DATA_FROM_TAB") {
    // Relay request to the content script of the active tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        sendResponse({ company: "", title: "", source: "" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { type: "GET_JOB_DATA" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          sendResponse({ company: "", title: "", source: "" });
        } else {
          sendResponse(response);
        }
      });
    });
    return true;
  }
});

async function checkDuplicate({ company, title, date }) {
  const { applications = [] } = await chrome.storage.local.get("applications");
  return applications.some(
    (a) =>
      a.company.toLowerCase() === company.toLowerCase() &&
      a.title.toLowerCase() === title.toLowerCase() &&
      a.date === date
  );
}

async function addApplication(entry) {
  const { applications = [] } = await chrome.storage.local.get("applications");

  const isDuplicate = applications.some(
    (a) =>
      a.company.toLowerCase() === entry.company.toLowerCase() &&
      a.title.toLowerCase() === entry.title.toLowerCase() &&
      a.date === entry.date
  );

  if (isDuplicate) return { success: false, reason: "duplicate" };

  applications.push(entry);
  await chrome.storage.local.set({ applications });

  // Green badge flash
  chrome.action.setBadgeText({ text: "✓" });
  chrome.action.setBadgeBackgroundColor({ color: "#22C55E" });
  setTimeout(() => chrome.action.setBadgeText({ text: "" }), 2500);

  return { success: true };
}
