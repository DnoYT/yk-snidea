<template>
  <div class="database-panel">
    <div class="header-section">
      <h2 class="page-title">
        <span
          class="iconify"
          data-icon="carbon:data-base"
        ></span>
        工作区数据库配置
      </h2>
      <p class="page-desc">
        配置当前项目的数据库连接，信息将加密保存在当前工作区的
        <code>.ykide/db-config.json</code> 中。
      </p>
    </div>

    <div class="form-card">
      <div class="form-row">
        <div class="form-item">
          <label>Host 主机地址</label>
          <input
            type="text"
            v-model="dbForm.host"
            placeholder="例如: 127.0.0.1"
          />
        </div>
        <div class="form-item port-item">
          <label>Port</label>
          <input
            type="number"
            v-model="dbForm.port"
            placeholder="3306"
          />
        </div>
      </div>

      <div class="form-row">
        <div class="form-item">
          <label>用户名 (User)</label>
          <input
            type="text"
            v-model="dbForm.user"
            placeholder="例如: root"
          />
        </div>
        <div class="form-item">
          <label>密码 (Password)</label>
          <input
            type="password"
            v-model="dbForm.password"
            placeholder="为空则不填"
          />
        </div>
      </div>

      <div class="form-item full-width">
        <label>数据库名称 (Database)</label>
        <input
          type="text"
          v-model="dbForm.database"
          placeholder="请输入要连接的数据库名"
        />
      </div>

      <button
        class="btn-primary"
        @click="handleTestAndSave"
        :disabled="isTesting"
      >
        <span
          class="iconify spin-icon"
          v-if="isTesting"
          data-icon="carbon:progress-bar-round"
        ></span>
        <span
          class="iconify"
          v-if="!isTesting"
          data-icon="carbon:connection-signal"
        ></span>
        {{ isTesting ? "正在测试连接并获取表结构..." : "测试并保存连接" }}
      </button>
    </div>

    <div
      class="feedback-section"
      v-if="globalState.dbConnected || testMessage"
    >
      <div
        class="status-card success"
        v-if="globalState.dbConnected"
      >
        <span
          class="iconify status-icon"
          data-icon="carbon:checkmark-filled"
        ></span>
        <div class="status-content">
          <h4>连接成功</h4>
          <p>
            已成功连接并读取到
            <strong>{{ globalState.tables.length }}</strong>
            张数据表，随时可在需求中通过 <code>#表名</code> 呼出。
          </p>
        </div>
      </div>

      <div
        class="status-card error"
        v-if="!globalState.dbConnected && testMessage"
      >
        <span
          class="iconify status-icon"
          data-icon="carbon:warning-filled"
        ></span>
        <div class="status-content">
          <h4>连接失败</h4>
          <p>{{ testMessage }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, inject, ref, onMounted, toRaw } from "vue";
import { vscodeApi } from "../utils/vscode.js";

const globalState = inject("globalState");
const isTesting = ref(false);
const testMessage = ref("");

const dbForm = reactive({
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "",
  database: "",
});

// --- 新增：初始化加载配置 ---
const loadSavedConfig = () => {
  vscodeApi.postMessage({ type: "getDbConfig" });
};

onMounted(() => {
  // 1. 组件加载后立即请求配置
  loadSavedConfig();

  // 2. 监听来自后端的消息
  vscodeApi.onMessage((msg) => {
    // 处理返回的数据库配置
    if (msg.type === "dbConfigData") {
      if (msg.config) {
        // 使用 Object.assign 将保存的配置合并到响应式对象中
        Object.assign(dbForm, msg.config);
        
        // 如果已经有配置，通常暗示之前可能连接过
        // 你也可以在这里决定是否自动触发一次测试，或者保持静默
        console.log("配置已加载:", msg.config);
      }
      return;
    }

    // 处理测试连接状态
    if (msg.type === "dbStatus") {
      isTesting.value = false;
      if (!msg.success) {
        testMessage.value = msg.error || "连接失败，请检查配置。";
        return;
      }
      testMessage.value = "";
      // 成功后，后端通常会返回 tables，globalState 会在外部被更新（如果使用了 provide/inject）
      return;
    }
  });
});

const handleTestAndSave = () => {
  if (!dbForm.host || !dbForm.database || !dbForm.user) {
    vscodeApi.postMessage({
      type: "error",
      value: "请填写完整的数据库必填信息",
    });
    return;
  }

  isTesting.value = true;
  testMessage.value = "";

  // 关键修复：发送原始对象，避免 Proxy 导致克隆失败
  vscodeApi.postMessage({ type: "saveDbConfig", data: toRaw(dbForm) });
};
</script>

<style scoped>
.database-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

/* 头部样式 */
.header-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.page-title {
  font-size: 16px;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vscode-sideBarTitle-foreground);
}
.page-desc {
  font-size: 12px;
  margin: 0;
  color: var(--vscode-descriptionForeground);
  line-height: 1.5;
}
code {
  background: var(--vscode-textCodeBlock-background);
  padding: 2px 4px;
  border-radius: 3px;
  font-family: monospace;
}

/* 卡片与表单 */
.form-card {
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 6px;
}
.form-row {
  display: flex;
  gap: 10px;
}
.form-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.port-item {
  flex: 0.4;
} /* 端口输入框窄一点 */
.full-width {
  width: 100%;
}

label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-editor-foreground);
  opacity: 0.8;
}
input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px;
  font-size: 12px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  outline: none;
  transition: border 0.2s;
}
input:focus {
  border-color: var(--vscode-focusBorder);
}

/* 按钮样式 */
.btn-primary {
  margin-top: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  font-size: 13px;
  font-weight: bold;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  transition: background 0.2s;
}
.btn-primary:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 旋转动画 */
.spin-icon {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

/* 反馈状态卡片 */
.feedback-section {
  animation: fadeIn 0.3s ease;
}
.status-card {
  display: flex;
  gap: 12px;
  padding: 12px 15px;
  border-radius: 6px;
  border-left: 4px solid transparent;
  background: var(--vscode-editor-background);
}
.status-card.success {
  border-left-color: #10b981;
}
.status-card.error {
  border-left-color: #ef4444;
}
.status-icon {
  font-size: 20px;
  flex-shrink: 0;
  margin-top: 2px;
}
.status-card.success .status-icon {
  color: #10b981;
}
.status-card.error .status-icon {
  color: #ef4444;
}
.status-content h4 {
  margin: 0 0 4px 0;
  font-size: 13px;
}
.status-content p {
  margin: 0;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.5;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
