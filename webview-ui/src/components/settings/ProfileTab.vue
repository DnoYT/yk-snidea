<template>
  <div class="setting-section">
    <button class="btn-dashed full-width" v-if="!isAdding" @click="toggleAdd(true)">
      <Icon icon="carbon:add" /> 新增组合规范
    </button>

    <div class="add-form" v-if="isAdding">
      <input type="text" v-model="addForm.name" placeholder="规范名称 (例: Vue3+Uniapp)" />
      <p class="sub-label">勾选包含的原子规则：</p>
      
      <div class="tree-container">
        <el-tree
          :data="treeData"
          show-checkbox
          node-key="id"
          :default-expand-all="true"
          :default-checked-keys="addForm.ruleIds"
          @check="onAddCheck"
        >
          <template #default="{ node, data }">
            <span class="custom-tree-node" :title="data.content">{{ node.label }}</span>
          </template>
        </el-tree>
      </div>

      <div class="btn-group" style="margin-top: 8px">
        <button class="btn-primary" @click="submitAdd">保存</button>
        <button class="btn-secondary" @click="toggleAdd(false)">取消</button>
      </div>
    </div>

    <div class="list-container">
      <div class="list-item-wrapper" v-for="profile in globalState.profiles" :key="profile.id">
        <div class="list-item-header" @click="toggleExpand(profile.id)">
          <span class="item-name">{{ profile.name }} ({{ profile.ruleIds.length }}项)</span>
          <Icon :icon="expandedId === profile.id ? 'carbon:chevron-up' : 'carbon:chevron-down'" />
        </div>

        <div class="list-item-body" v-if="expandedId === profile.id">
          <div v-if="editingId !== profile.id">
            <ul class="preview-list">
              <li v-for="ruleId in profile.ruleIds" :key="ruleId">• {{ getRuleName(ruleId) }}</li>
            </ul>
            <div class="action-bar">
              <span class="action-btn" @click="startEdit(profile)"><Icon icon="carbon:edit" /> 编辑</span>
              <span class="action-btn danger" @click="deleteItem(profile.id)"><Icon icon="carbon:trash-can" /> 删除</span>
            </div>
          </div>

          <div class="edit-form" v-if="editingId === profile.id">
            <input type="text" v-model="editForm.name" placeholder="规范名称" />
            
            <div class="tree-container">
              <el-tree
                :data="treeData"
                show-checkbox
                node-key="id"
                :default-expand-all="true"
                :default-checked-keys="editForm.ruleIds"
                @check="onEditCheck"
              >
                <template #default="{ node, data }">
                  <span class="custom-tree-node" :title="data.content">{{ node.label }}</span>
                </template>
              </el-tree>
            </div>

            <div class="btn-group" style="margin-top: 8px">
              <button class="btn-primary" @click="submitEdit">更新</button>
              <button class="btn-secondary" @click="cancelEdit">取消</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, inject, computed } from "vue";
import { Icon } from "@iconify/vue";
import { ElTree } from "element-plus";
import "element-plus/theme-chalk/el-tree.css";
import "element-plus/theme-chalk/el-checkbox.css";
import { vscodeApi } from "../../utils/vscode.js";

const globalState = inject("globalState");
const isAdding = ref(false);
const expandedId = ref(null);
const editingId = ref(null);

const addForm = reactive({ name: "", ruleIds: [] });
const editForm = reactive({ id: "", name: "", ruleIds: [] });

const treeData = computed(() => {
  const groups = {};
  const rules = globalState.rules || [];

  rules.forEach((rule) => {
    const match = rule.name.match(/^\[(.*?)\]/);
    const prefix = match ? match[1] : "通用规则 (无前缀)";

    if (!groups[prefix]) {
      groups[prefix] = {
        id: `group_${prefix}`,
        label: prefix,
        children: [],
      };
    }
    groups[prefix].children.push({
      id: rule.id,
      label: rule.name,
      content: rule.content,
    });
  });

  return Object.values(groups);
});

const onAddCheck = (nodeObj, treeStatus) => {
  addForm.ruleIds = treeStatus.checkedKeys.filter(id => !id.toString().startsWith("group_"));
};

const onEditCheck = (nodeObj, treeStatus) => {
  editForm.ruleIds = treeStatus.checkedKeys.filter(id => !id.toString().startsWith("group_"));
};

const toggleAdd = (val) => {
  isAdding.value = val;
  addForm.name = ""; addForm.ruleIds = [];
};

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id;
  editingId.value = null;
};

const startEdit = (item) => {
  editingId.value = item.id;
  editForm.id = item.id;
  editForm.name = item.name;
  editForm.ruleIds = [...item.ruleIds];
};

const cancelEdit = () => { editingId.value = null; };

const getRuleName = (ruleId) => {
  const rule = globalState.rules.find((r) => r.id === ruleId);
  return rule ? rule.name : "未知规则";
};

const submitAdd = () => {
  if (!addForm.name.trim()) {
    vscodeApi.postMessage({ type: "error", value: "名称不能为空" });
    return;
  }
  vscodeApi.postMessage({ type: "saveProfile", data: { id: `profile_${Date.now()}`, name: addForm.name.trim(), ruleIds: [...addForm.ruleIds] } });
  toggleAdd(false);
};

const submitEdit = () => {
  if (!editForm.name.trim()) {
    vscodeApi.postMessage({ type: "error", value: "名称不能为空" });
    return;
  }
  vscodeApi.postMessage({ type: "saveProfile", data: { ...editForm } });
  editingId.value = null;
};

const deleteItem = (id) => {
  vscodeApi.postMessage({ type: "deleteProfile", profileId: id });
  expandedId.value = null;
};
</script>

<style scoped lang="scss">
@use "../SettingsPanel.scss";

.tree-container {
  max-height: 250px;
  overflow-y: auto;
  border: 1px solid var(--vscode-widget-border);
  border-radius: 4px;
  padding: 8px;
  background: var(--vscode-input-background);
}

.custom-tree-node {
  font-size: 12px;
  color: var(--vscode-editor-foreground);
}

/* --- 🌟 核心修复点：强制修复 Checkbox 的边框和颜色 --- */
:deep(.el-tree) {
  background: transparent;
  color: var(--vscode-editor-foreground);
}
:deep(.el-tree-node__content:hover) {
  background-color: var(--vscode-list-hoverBackground);
}

/* 强制重写边框，避免融入背景 */
:deep(.el-checkbox__inner) {
  background-color: var(--vscode-checkbox-background, #ffffff) !important;
  border: 1px solid var(--vscode-checkbox-border, #888888) !important;
}
/* 勾选及半选状态的背景色 */
:deep(.el-checkbox__input.is-checked .el-checkbox__inner),
:deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) {
  background-color: var(--vscode-button-background, #007acc) !important;
  border-color: var(--vscode-button-background, #007acc) !important;
}
/* 对勾和半选横线的颜色 */
:deep(.el-checkbox__inner::after) {
  border-color: var(--vscode-checkbox-foreground, #ffffff) !important;
}
:deep(.el-checkbox__inner::before) {
  background-color: var(--vscode-checkbox-foreground, #ffffff) !important;
}
</style>