<template>
  <div class="main-form">
    <!-- 头部表单区域 -->
    <div class="card">
      <div class="form-group">
        <label>
          <span class="iconify" data-icon="carbon:user-role"></span>
          AI 角色选择
        </label>
        <select v-model="form.skill">
          <option value="">-- 请选择或手动输入需求 --</option>
          <option v-for="role in globalState.roles" :key="role.id" :value="role.name">
            {{ role.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>
          <span class="iconify" data-icon="carbon:rule"></span>
          绑定开发规范 (Profile)
        </label>
        <select v-model="form.profileId">
          <option value="">-- 手动输入规范 --</option>
          <option v-for="p in globalState.profiles" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>
          <span class="iconify" data-icon="carbon:edit"></span>
          开发需求 (@文件, #数据库表)
        </label>
        <RichEditor
          placeholder="请输入开发任务详情..."
          v-model:files="form.selectedFiles"
          v-model:tables="form.selectedTables"
          @change="(val) => (form.requirement = val)"
        />
      </div>

      <button class="btn-primary btn-generate" @click="handleGenerate" :disabled="loading">
        <span class="iconify" :class="{ 'spin': loading }" :data-icon="loading ? 'carbon:renew' : 'carbon:magic-wand'"></span>
        {{ loading ? "解析上下文并生成中..." : "生成提示词" }}
      </button>
    </div>

    <!-- 结果展示区域 -->
    <div class="result-section" v-if="result">
      <div class="result-header">
        <div class="title">
          <span class="iconify" data-icon="carbon:document-view"></span>
          生成结果
        </div>
        <div class="actions">
          <button class="icon-btn" title="保存到 .ykide" @click="handleSaveFile">
            <span class="iconify" data-icon="carbon:save"></span>
            存为 MD
          </button>
          <button class="icon-btn highlight" title="复制" @click="copyResult">
            <span class="iconify" data-icon="carbon:copy"></span>
            复制
          </button>
        </div>
      </div>
      <textarea readonly v-model="result" class="result-area"></textarea>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, inject, onMounted, toRaw } from "vue";
import { vscodeApi } from "../utils/vscode.js";
import RichEditor from "./RichEditor.vue";

const globalState = inject("globalState");
const loading = ref(false);
const result = ref("");

const form = reactive({
  skill: "资深全栈工程师",
  profileId: "",
  selectedFiles: [],
  selectedTables: [],
  requirement: "",
});

const handleGenerate = () => {
  if (!form.requirement) {
    vscodeApi.postMessage({ type: "error", value: "需求内容不能为空" });
    return;
  }
  loading.value = true;
  vscodeApi.postMessage({
    type: "generate",
    data: {
      skill: form.skill,
      profileId: form.profileId,
      files: toRaw(form.selectedFiles),
      selectedTables: toRaw(form.selectedTables),
      requirement: form.requirement,
    },
  });
};

// 复制：通过后端执行，成功率 100%
const copyResult = () => {
  vscodeApi.postMessage({ type: "copyToClipboard", value: result.value });
};

// 保存到文件
const handleSaveFile = () => {
  vscodeApi.postMessage({
    type: "savePromptFile",
    value: result.value,
    files: toRaw(form.selectedFiles)
  });
};

onMounted(() => {
  vscodeApi.postMessage({ type: "getPromptConfig" });
  vscodeApi.onMessage((msg) => {
    if (msg.type === "promptConfigData" && msg.data) {
      Object.assign(form, msg.data);
    }
    if (msg.type === "renderResult") {
      result.value = msg.value;
      loading.value = false;
    }
  });
});
</script>

<style scoped>
.main-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px;
}

/* 卡片式容器 */
.card {
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 6px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-foreground);
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.9;
}
select {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px;
  font-family: var(--vscode-font-family);
  font-size: 13px;
  
  /* 颜色适配 VS Code 变量 */
  background: var(--vscode-select-background);
  color: var(--vscode-select-foreground);
  border: 1px solid var(--vscode-select-border);
  border-radius: 4px;
  
  cursor: pointer;
  outline: none;
  
  /* 移除系统默认箭头，稍后可以自己加或者保留（推荐保留以保证可用性） */
  appearance: none; 
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23cccccc' d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
}

/* 按钮样式优化 */
.btn-primary {
  padding: 10px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 600;
  transition: filter 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--vscode-button-hoverBackground);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: wait;
}

/* 结果区域 */
.result-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: slideUp 0.3s ease-out;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-header .title {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 6px;
}

.actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  background: transparent;
  border: 1px solid var(--vscode-panel-border);
  color: var(--vscode-foreground);
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.icon-btn:hover {
  background: var(--vscode-toolbar-hoverBackground);
}

.icon-btn.highlight {
  border-color: var(--vscode-button-background);
  color: var(--vscode-button-background);
}

.result-area {
  width: 100%;
  min-height: 350px;
  background: var(--vscode-textCodeBlock-background);
  color: var(--vscode-editor-foreground);
  border: 1px solid var(--vscode-widget-border);
  border-radius: 4px;
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  padding: 12px;
  resize: vertical;
  line-height: 1.5;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

select:focus {
  border-color: var(--vscode-focusBorder);
}


/* 注意：部分系统下 option 的 padding 依然无效，但背景和文字颜色可以强制统一 */
select option {
  background-color: var(--vscode-dropdown-background);
  color: var(--vscode-dropdown-foreground);
  padding: 8px; /* 某些浏览器内核支持 */
  font-size: 13px;
}

/* 针对禁用状态或提示选项 */
select option:disabled {
  color: var(--vscode-disabledForeground);
  opacity: 0.5;
}

/* 兼容深色/浅色主题的边框悬停 */
select:hover {
  border-color: var(--vscode-settings-dropdownListBorder) || var(--vscode-button-background);
}
</style>