<template>
  <div class="settings-panel">
   <div class="global-action-bar">
      <span class="view-title">全局配置管理</span>
      <div class="actions">
        <Icon
          icon="carbon:document-import"
          class="icon-btn"
          title="从本地导入配置"
          @click="importSettings"
        />
        <Icon
          icon="carbon:document-export"
          class="icon-btn"
          title="导出当前所有配置到 .ykide 文件夹"
          @click="exportSettings"
        />
      </div>
    </div>

    <div class="sub-tabs">
      <div :class="['tab-item', { active: activeTab === 'role' }]" @click="activeTab = 'role'">
        <Icon icon="carbon:user-role" /> 角色
      </div>
      <div :class="['tab-item', { active: activeTab === 'rule' }]" @click="activeTab = 'rule'">
        <Icon icon="carbon:rule" /> 规则
      </div>
      <div :class="['tab-item', { active: activeTab === 'profile' }]" @click="activeTab = 'profile'">
        <Icon icon="carbon:category" /> 规范
      </div>
      <div :class="['tab-item', { active: activeTab === 'diff' }]" @click="activeTab = 'diff'">
        <Icon icon="carbon:code" /> 格式(Diff/JSON)
      </div>
    </div>

    <div class="tab-content">
      <RoleTab v-if="activeTab === 'role'" />
      <RuleTab v-if="activeTab === 'rule'" />
      <ProfileTab v-if="activeTab === 'profile'" />
      <DiffTab v-if="activeTab === 'diff'" />
    </div>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { Icon } from "@iconify/vue";
import { vscodeApi } from "../utils/vscode.js";
import RoleTab from "./settings/RoleTab.vue";
import RuleTab from "./settings/RuleTab.vue";
import ProfileTab from "./settings/ProfileTab.vue";
import DiffTab from "./settings/DiffTab.vue";

const activeTab = ref("role");

const exportSettings = () => {
  console.log("[前端] 准备发送导出配置请求...");
  vscodeApi.postMessage({ type: "exportSettings" });
};

const importSettings = () => {
  vscodeApi.postMessage({ type: "importSettings" });
};
</script>

<style scoped lang="scss">
@use "./SettingsPanel.scss";
</style>