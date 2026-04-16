const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appApi", {
  runOnce: (payload) => ipcRenderer.invoke("run-once", payload ?? {}),
  getAppConfig: () => ipcRenderer.invoke("get-app-config"),
  saveAppConfig: (config) => ipcRenderer.invoke("save-app-config", config),
  addAccount: (payload) => ipcRenderer.invoke("add-account", payload ?? {}),
  readLog: (payload) => ipcRenderer.invoke("read-log", payload ?? {}),
  openDashboard: () => ipcRenderer.invoke("open-dashboard"),
  openOutput: () => ipcRenderer.invoke("open-output"),
  openLogs: () => ipcRenderer.invoke("open-logs"),
  openAppFolder: () => ipcRenderer.invoke("open-app-folder"),
  getScheduleHint: () => ipcRenderer.invoke("get-schedule-hint"),
  onJobFinished: (fn) => {
    ipcRenderer.on("job-finished", (_e, payload) => fn(payload));
  },
});
