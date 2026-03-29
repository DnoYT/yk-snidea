<template>
  <div class="setting-section scrollable-container">
    <div 
      v-for="(item, index) in configDefinitions" 
      :key="item.key" 
      class="config-block"
      :class="{ 'spacing-top': index > 0 }"
    >
      <div class="block-header">
        <p class="sub-label">{{ item.label }}：</p>
        <button class="reset-link-btn" @click="handleReset(item.resetType)" title="恢复系统默认配置">
          <Icon icon="carbon:reset" /> 重置
        </button>
      </div>
      <textarea v-model="localPrompts[item.key]" rows="11"></textarea>
      <div class="btn-group">
        <button class="btn-primary" @click="handleSave(item.saveType, item.key)">
          保存 {{ item.shortName }} 规则
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, inject, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { vscodeApi } from "../../utils/vscode.js";

const globalState = inject("globalState");

/**
 * 局部响应式状态，用于 textarea 绑定
 */
const localPrompts = reactive({
  xml: "",
  diff: "",
  json: ""
});

/**
 * 配置项定义元数据
 */
const configDefinitions = [
  { 
    key: 'xml', 
    label: 'XML 标签化提示词配置 (推荐)', 
    shortName: 'XML', 
    configSource: 'xmlConfig', 
    saveType: 'saveXmlConfig', 
    resetType: 'resetXmlConfig' 
  },
  { 
    key: 'diff', 
    label: 'Diff/Replace 提示词配置', 
    shortName: 'Diff', 
    configSource: 'diffConfig', 
    saveType: 'saveDiffConfig', 
    resetType: 'resetDiffConfig' 
  },
  { 
    key: 'json', 
    label: 'JSON 结构化提示词配置', 
    shortName: 'JSON', 
    configSource: 'jsonConfig', 
    saveType: 'saveJsonConfig', 
    resetType: 'resetJsonConfig' 
  }
];

// 统一监听 globalState 中的配置变化并同步到局部状态
configDefinitions.forEach(def => {
  watch(() => globalState[def.configSource], (newVal) => {
    if (newVal && newVal.prompt) {
      localPrompts[def.key] = newVal.prompt;
    }
  }, { immediate: true, deep: true });
});

/**
 * 统一保存处理函数
 */
const handleSave = (messageType, key) => {
  vscodeApi.postMessage({
    type: messageType,
    data: { enabled: true, prompt: localPrompts[key] }
  });
};

/**
 * 统一重置处理函数
 */
const handleReset = (messageType) => {
  vscodeApi.postMessage({ type: messageType });
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

.spacing-top {
  margin-top: 14px;
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