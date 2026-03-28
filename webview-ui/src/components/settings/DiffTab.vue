<template>
  <div class="setting-section scrollable-container">
    <div class="config-block">
      <div class="block-header">
        <p class="sub-label">Diff/Replace 提示词配置：</p>
        <button class="reset-link-btn" @click="resetDiff" title="恢复系统默认配置">
          <Icon icon="carbon:reset" /> 重置
        </button>
      </div>
      <textarea v-model="localDiffPrompt" rows="11"></textarea>
      <div class="btn-group">
        <button class="btn-primary" @click="saveDiff">保存 Diff 规则</button>
      </div>
    </div>

    <div class="config-block" style="margin-top: 14px;">
      <div class="block-header">
        <p class="sub-label">JSON 结构化提示词配置：</p>
        <button class="reset-link-btn" @click="resetJson" title="恢复系统默认配置">
          <Icon icon="carbon:reset" /> 重置
        </button>
      </div>
      <textarea v-model="localJsonPrompt" rows="11"></textarea>
      <div class="btn-group">
        <button class="btn-primary" @click="saveJson">保存 JSON 规则</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { vscodeApi } from "../../utils/vscode.js";

const globalState = inject("globalState");
const localDiffPrompt = ref("");
const localJsonPrompt = ref("");

// 監聽 Diff 配置
watch(() => globalState.diffConfig, (newVal) => {
    if (!newVal || !newVal.prompt) return;
    localDiffPrompt.value = newVal.prompt;
    console.log("[DiffTab] Diff 配置已同步至 UI");
}, { immediate: true, deep: true });

// 監聽 JSON 配置
watch(() => globalState.jsonConfig, (newVal) => {
    if (!newVal || !newVal.prompt) {
        console.warn("[DiffTab] 收到空的 JSON 配置");
        return;
    }
    localJsonPrompt.value = newVal.prompt;
    console.log("[DiffTab] JSON 配置已同步至 UI");
}, { immediate: true, deep: true });

const saveDiff = () => {
    vscodeApi.postMessage({
        type: "saveDiffConfig",
        data: { enabled: true, prompt: localDiffPrompt.value }
    });
};

const saveJson = () => {
    vscodeApi.postMessage({
        type: "saveJsonConfig",
        data: { enabled: true, prompt: localJsonPrompt.value }
    });
};

const resetDiff = () => {
    vscodeApi.postMessage({ type: "resetDiffConfig" });
};

const resetJson = () => {
    vscodeApi.postMessage({ type: "resetJsonConfig" });
};
</script>

<style scoped lang="scss">
@use "../SettingsPanel.scss";

.scrollable-container {
    max-height: calc(100vh - 110px);
    overflow-y: auto;
    padding-right: 4px;
}

.config-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.reset-link-btn {
    background: none;
    border: none;
    color: var(--vscode-textLink-foreground);
    font-size: 11px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    opacity: 0.8;
    padding: 2px 4px;
}

.reset-link-btn:hover {
    opacity: 1;
    text-decoration: underline;
}
</style>