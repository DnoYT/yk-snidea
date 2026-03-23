<template>
  <div class="app-container">
    <header class="nav-header">
      <div
        :class="['nav-item', { active: currentView === 'main' }]"
        @click="switchView('main')"
      >
        <span
          class="iconify"
          data-icon="carbon:home"
        ></span>
        生成提示词
      </div>
      <div
        :class="['nav-item', { active: currentView === 'database' }]"
        @click="switchView('database')"
      >
        <span
          class="iconify"
          data-icon="carbon:data-base"
        ></span>
        数据库
      </div>
      <div
        :class="['nav-item', { active: currentView === 'settings' }]"
        @click="switchView('settings')"
      >
        <span
          class="iconify"
          data-icon="carbon:settings"
        ></span>
        全局设置
      </div>
    </header>

    <div class="view-content">
      <MainForm v-show="currentView === 'main'" />
      <DatabasePanel v-show="currentView === 'database'" />
      <SettingsPanel v-show="currentView === 'settings'" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, provide, onMounted } from "vue";
import { vscodeApi } from "./utils/vscode.js";
import MainForm from "./components/MainForm.vue";
import DatabasePanel from "./components/DatabasePanel.vue";
import SettingsPanel from "./components/SettingsPanel.vue";

const currentView = ref("main");

// 扩展全局状态，加入 roles
const globalState = reactive({
  roles: [],
  rules: [],
  profiles: [],
  dbConnected: false,
  tables: [],
});

provide("globalState", globalState);

const switchView = (viewName) => {
  if (currentView.value === viewName) return;
  currentView.value = viewName;
};

onMounted(() => {
  vscodeApi.onMessage((msg) => {
    if (msg.type === "settingsData") {
      globalState.roles = msg.roles || [];
      globalState.rules = msg.rules || [];
      globalState.profiles = msg.profiles || [];
      return;
    }

    if (msg.type === "dbStatus") {
      if (msg.success) {
        globalState.dbConnected = true;
        globalState.tables = msg.tables || [];
        return;
      }
      globalState.dbConnected = false;
      globalState.tables = [];
      return;
    }
  });

  vscodeApi.postMessage({ type: "getSettings" });
});
</script>

<style>
body {
  margin: 0;
  padding: 0;
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  background-color: var(--vscode-sideBar-background);
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.nav-header {
  display: flex;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-editor-background);
}
.nav-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 4px;
  cursor: pointer;
  font-size: 12px;
  opacity: 0.7;
  transition: all 0.2s;
}
.nav-item:hover {
  opacity: 1;
  background: var(--vscode-list-hoverBackground);
}
.nav-item.active {
  opacity: 1;
  border-bottom: 2px solid var(--vscode-activityBar-activeBorder);
  color: var(--vscode-activityBar-activeBorder);
  font-weight: bold;
}
.view-content {
  flex: 1;
  overflow-y: auto;
  padding: 15px 10px;
}
</style>
