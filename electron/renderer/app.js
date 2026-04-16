const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function setRunStatus(text, cls) {
  const el = $("run-status");
  el.textContent = text;
  el.className = "status-line " + (cls || "");
}

function setConfigStatus(text, cls) {
  const el = $("config-status");
  el.textContent = text;
  el.className = "status-line " + (cls || "");
}

function setBusy(btn, busy) {
  btn.disabled = busy;
  btn.setAttribute("aria-busy", busy ? "true" : "false");
  const label = btn.querySelector(".btn-main__label");
  if (label) label.textContent = busy ? "처리 중…" : "지금 발행 실행";
}

function fillAccountSelects(accounts) {
  const runSel = $("account-run");
  const logSel = $("account-log");
  runSel.innerHTML = "";
  logSel.innerHTML = "";
  const enabled = accounts.filter((a) => a.enabled);
  const list = enabled.length ? enabled : accounts;
  for (const a of list) {
    const o1 = document.createElement("option");
    o1.value = a.id;
    o1.textContent = `${a.name} (${a.id})`;
    runSel.appendChild(o1);
    const o2 = document.createElement("option");
    o2.value = a.id;
    o2.textContent = `${a.name} (${a.id})`;
    logSel.appendChild(o2);
  }
  if (!list.length) {
    const o = document.createElement("option");
    o.value = "";
    o.textContent = "계정 없음";
    runSel.appendChild(o);
    logSel.appendChild(o.cloneNode(true));
  }
}

async function loadConfigEditor() {
  const ta = $("config-json");
  if (!window.appApi) return;
  const r = await window.appApi.getAppConfig();
  if (!r.ok) {
    setConfigStatus(r.error || "불러오기 실패", "err");
    return;
  }
  ta.value = JSON.stringify(r.config, null, 2);
  fillAccountSelects(r.config.accounts || []);
  setConfigStatus("불러왔습니다.", "ok");
}

async function refreshSchedule() {
  const info = $("schedule-info");
  if (!window.appApi) {
    info.innerHTML = `<span class="err">API를 불러올 수 없습니다.</span>`;
    return;
  }
  const h = await window.appApi.getScheduleHint();
  if (h.error) {
    info.innerHTML = `<span class="err">${escapeHtml(h.error)}</span>`;
    return;
  }
  const detail = h.detail
    ? escapeHtml(h.detail).replace(/\n/g, "<br />")
    : "";
  info.innerHTML =
    `<strong>예약</strong> ${escapeHtml(h.cron)}<br />` +
    (detail ? `${detail}<br />` : "") +
    `<strong>작업 폴더</strong> <code>${escapeHtml(h.appRoot || "")}</code>`;
}

async function refreshLog() {
  const pre = $("log-view");
  const logSel = $("account-log");
  const id = logSel.value;
  if (!window.appApi || !id) {
    pre.textContent = "";
    return;
  }
  pre.textContent = "불러오는 중…";
  const r = await window.appApi.readLog({ accountId: id, maxLines: 400 });
  if (!r.ok) {
    pre.textContent = r.error || "로그를 읽을 수 없습니다.";
    return;
  }
  pre.textContent = r.text || "(로그가 비어 있음)";
}

document.addEventListener("DOMContentLoaded", () => {
  refreshSchedule();
  loadConfigEditor().then(() => refreshLog());

  $("btn-run").addEventListener("click", async () => {
    const btn = $("btn-run");
    const accountId = $("account-run").value;
    setBusy(btn, true);
    setRunStatus("실행 중입니다. 잠시만 기다려 주세요.", "");
    try {
      const r = await window.appApi.runOnce(
        accountId ? { accountId } : undefined,
      );
      if (r.ok) {
        setRunStatus("완료되었습니다. 「발행 기록」에서 결과를 확인하세요.", "ok");
      } else {
        setRunStatus("실패: " + (r.error || "알 수 없음"), "err");
      }
      await refreshLog();
    } catch (e) {
      setRunStatus(String(e), "err");
    } finally {
      setBusy(btn, false);
    }
  });

  $("btn-dashboard").addEventListener("click", () => window.appApi.openDashboard());
  $("btn-output").addEventListener("click", () => window.appApi.openOutput());
  $("btn-logs").addEventListener("click", () => window.appApi.openLogs());
  $("btn-folder").addEventListener("click", () => window.appApi.openAppFolder());

  $("btn-refresh-log").addEventListener("click", () => refreshLog());
  $("account-log").addEventListener("change", () => refreshLog());

  $("btn-reload-config").addEventListener("click", () => {
    loadConfigEditor().then(() => {
      refreshSchedule();
      refreshLog();
    });
  });

  $("btn-add-account").addEventListener("click", async () => {
    const name = ($("new-account-name").value || "").trim();
    setConfigStatus("추가 중…", "");
    try {
      const r = await window.appApi.addAccount({ name });
      if (r.ok && r.config) {
        $("config-json").value = JSON.stringify(r.config, null, 2);
        fillAccountSelects(r.config.accounts || []);
        $("new-account-name").value = "";
        setConfigStatus("계정을 추가해 저장했습니다. WordPress 정보를 채운 뒤 필요하면 다시 저장하세요.", "ok");
        refreshSchedule();
        await refreshLog();
      } else {
        setConfigStatus("추가 실패: " + (r.error || ""), "err");
      }
    } catch (e) {
      setConfigStatus(String(e), "err");
    }
  });

  $("btn-save-config").addEventListener("click", async () => {
    const raw = $("config-json").value;
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setConfigStatus("JSON 형식이 올바르지 않습니다.", "err");
      return;
    }
    setConfigStatus("저장 중…", "");
    const r = await window.appApi.saveAppConfig(parsed);
    if (r.ok) {
      setConfigStatus("저장했습니다.", "ok");
      fillAccountSelects(parsed.accounts || []);
      refreshSchedule();
    } else {
      setConfigStatus("저장 실패: " + (r.error || ""), "err");
    }
  });

  window.appApi.onJobFinished(() => {
    setRunStatus("예약 스케줄에 따라 실행되었습니다.", "ok");
    refreshSchedule();
    refreshLog();
  });
});
