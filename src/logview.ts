import sw from "./features/service-worker-interface";

const statusLine = document.getElementById("status_line") as HTMLDivElement;
const app = document.getElementById("app") as HTMLDivElement;
const reloadBtn = document.getElementById("reload_btn") as HTMLButtonElement;
const exportBtn = document.getElementById(
  "export_btn",
) as HTMLButtonElement | null;
const prevBtn = document.getElementById(
  "prev_page",
) as HTMLButtonElement | null;
const nextBtn = document.getElementById(
  "next_page",
) as HTMLButtonElement | null;
const pageInfo = document.getElementById("page_info") as HTMLDivElement | null;
const filterLevel = document.getElementById(
  "filter_level",
) as HTMLSelectElement | null;
const debugLog = document.getElementById("debuglog") as HTMLTextAreaElement;

let page = 0;
const pageSize = 50;

function logDebug(msg: string) {
  if (debugLog)
    debugLog.value = `${new Date().toISOString()} ${msg}\n` + debugLog.value;
}

async function loadPage() {
  statusLine.textContent = `Loading page ${page + 1}...`;
  const from = page * pageSize;
  const level = filterLevel?.value;
  const payload: any = { limit: pageSize, offset: from };
  if (level) payload.level = [level];
  const resp = await sw.queryLogs(payload);
  renderEntries(resp.entries || []);
  statusLine.textContent = `Showing ${resp.entries.length} of ${resp.total}`;
  if (pageInfo) pageInfo.textContent = `Page ${page + 1}`;
}

function renderEntries(entries: any[]) {
  app.innerHTML = "";
  const table = document.createElement("table");
  table.style.width = "100%";
  const header = document.createElement("tr");
  ["ts", "level", "type", "message", "source"].forEach((h) => {
    const th = document.createElement("th");
    th.textContent = h;
    header.appendChild(th);
  });
  table.appendChild(header);

  entries.forEach((e) => {
    const tr = document.createElement("tr");
    const ts = new Date(e.ts).toLocaleString();
    [ts, e.level, e.type, e.message, e.source].forEach((v) => {
      const td = document.createElement("td");
      td.textContent = v ?? "";
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  app.appendChild(table);
}

reloadBtn?.addEventListener("click", async () => {
  page = 0;
  await loadPage();
  logDebug("Reloaded logs");
});

exportBtn?.addEventListener("click", async () => {
  statusLine.textContent = "Preparing export...";
  const level = filterLevel?.value;
  const payload: any = { limit: 10000 };
  if (level) payload.level = [level];
  const resp = await sw.exportLogs(payload);
  const blob = new Blob([JSON.stringify(resp.entries, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `hh-logs-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  statusLine.textContent = `Exported ${resp.total} entries`;
  logDebug("Exported logs");
});

// TODO: Implement the max-limit for the page.
prevBtn?.addEventListener("click", async () => {
  if (page > 0) page -= 1;
  await loadPage();
});
nextBtn?.addEventListener("click", async () => {
  page += 1;
  await loadPage();
});

filterLevel?.addEventListener("change", async () => {
  page = 0;
  await loadPage();
});

// Initial load
loadPage().catch((e) => {
  console.error("Failed to load logs:", e);
  statusLine.textContent = "Failed to load logs";
});
