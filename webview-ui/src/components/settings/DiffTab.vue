<template>
  <div class="setting-section scrollable-container">
    <div class="config-block">
      <p class="sub-label">Diff/Replace 提示词配置：</p>
      <textarea v-model="localDiffPrompt" rows="11"></textarea>
      <div class="btn-group">
        <button class="btn-primary" @click="saveDiff">保存 Diff 规则</button>
      </div>
    </div>

    <div class="config-block" style="margin-top: 14px;">
      <p class="sub-label">JSON 结构化提示词配置：</p>
      <textarea v-model="localJsonPrompt" rows="11"></textarea>
      <div class="btn-group">
        <button class="btn-primary" @click="saveJson">保存 JSON 规则</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch } from 'vue';
import { vscodeApi } from "../../utils/vscode.js";

const globalState = inject("globalState");
const localDiffPrompt = ref("");
const localJsonPrompt = ref("");

watch(() => globalState.diffConfig, (newVal) => {
    if (newVal && newVal.prompt) {
        localDiffPrompt.value = newVal.prompt;
    }
}, { immediate: true, deep: true });

watch(() => globalState.jsonConfig, (newVal) => {
    if (newVal && newVal.prompt) {
        localJsonPrompt.value = newVal.prompt;
    }
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
</style>