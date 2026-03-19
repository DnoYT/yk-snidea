<template>
  <div class="main-form">
    <div class="form-group">
      <label>AI 角色选择</label>
      <select v-model="form.skill">
        <option value="">-- 请选择或手动输入需求 --</option>
        <option
          v-for="role in globalState.roles"
          :key="role.id"
          :value="role.name"
        >
          {{ role.name }}
        </option>
      </select>
    </div>

    <div class="form-group">
      <label>绑定开发规范 (Profile)</label>
      <select v-model="form.profileId">
        <option value="">-- 手动输入规范 --</option>
        <option
          v-for="p in globalState.profiles"
          :key="p.id"
          :value="p.id"
        >
          {{ p.name }}
        </option>
      </select>
    </div>

    <div class="form-group">
      <label>开发需求 (@搜索文件, #搜索数据库表)</label>
      <RichEditor
        placeholder="请输入开发任务详情..."
        v-model:files="form.selectedFiles"
        v-model:tables="form.selectedTables"
        @change="(val) => (form.requirement = val)"
      />
    </div>

    <div class="btn-group">
      <button
        class="btn-generate"
        @click="handleGenerate"
        :disabled="loading"
      >
        <span
          class="iconify"
          :data-icon="loading ? 'carbon:renew' : 'carbon:magic-wand'"
        ></span>
        {{ loading ? "解析中..." : "生成提示词" }}
      </button>
    </div>

    <div
      class="form-group"
      v-if="result"
    >
      <div class="result-header">
        <label>生成结果</label>
        <span
          class="copy-link"
          @click="copyResult"
          >点击复制</span
        >
      </div>
      <textarea
        readonly
        v-model="result"
        class="result-area"
      ></textarea>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, inject, onMounted } from "vue";
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
      skills: form.skill,
      profileId: form.profileId,
      files: form.selectedFiles,
      selectedTables: form.selectedTables,
      requirement: form.requirement,
    },
  });
};

const copyResult = async () => {
  if (!result.value) return;
  try {
    await navigator.clipboard.writeText(result.value);
    vscodeApi.postMessage({ type: "info", value: "已复制到剪贴板" });
  } catch (err) {
    vscodeApi.postMessage({ type: "error", value: "复制失败" });
  }
};

onMounted(() => {
  vscodeApi.onMessage((msg) => {
    if (msg.type === "renderResult") {
      result.value = msg.value;
      loading.value = false;
      return;
    }
  });
});
</script>

<style scoped>
.main-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
label {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.8;
}
select {
  padding: 6px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
}
.btn-generate {
  width: 100%;
  padding: 10px;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.btn-generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.copy-link {
  font-size: 11px;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
}
.result-area {
  width: 100%;
  min-height: 150px;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  border: 1px solid var(--vscode-input-border);
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  padding: 8px;
  resize: vertical;
}
</style>
