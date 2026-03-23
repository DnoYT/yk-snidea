<template>
  <div class="settings-panel">
    <div class="global-action-bar">
      <span class="view-title">全局配置管理</span>
      <Icon
        icon="carbon:document-export"
        class="icon-btn"
        title="导出当前所有配置到 .ykide 文件夹"
        @click="exportSettings"
      />
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
    </div>

    <div class="tab-content">
      <RoleTab v-if="activeTab === 'role'" />
      <RuleTab v-if="activeTab === 'rule'" />
      <ProfileTab v-if="activeTab === 'profile'" />
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

const activeTab = ref("role");

const exportSettings = () => {
  // 增加前端调试日志，确保点击事件被触发
  console.log("[前端] 准备发送导出配置请求...");
  vscodeApi.postMessage({ type: "exportSettings" });
};
</script>

<style scoped lang="scss">
@use "./SettingsPanel.scss";
</style>