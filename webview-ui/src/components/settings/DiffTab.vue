<template>
  <div class="setting-section">
    <p class="sub-label">默认的 Diff/Replace 提示词格式：</p>
    <textarea v-model="localPrompt" rows="22"></textarea>
    <div class="btn-group">
      <button class="btn-primary" @click="save">保存更新</button>
    </div>
  </div>
</template>

<script setup>
import { ref, inject, watch } from 'vue';
import { vscodeApi } from "../../utils/vscode.js";

const globalState = inject("globalState");
const localPrompt = ref("");

watch(() => globalState.diffConfig, (newVal) => {
    if (newVal) {
        localPrompt.value = newVal.prompt;
    }
}, { immediate: true, deep: true });

const save = () => {
    vscodeApi.postMessage({
        type: "saveDiffConfig",
        data: { enabled: true, prompt: localPrompt.value }
    });
};
</script>

<style scoped lang="scss">
@use "../SettingsPanel.scss";
</style>