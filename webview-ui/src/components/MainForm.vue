<template>
  <div class="main-form">
    <div class="card">
      <div class="form-group">
        <label>
          <Icon icon="carbon:user-role" class="header-icon" />
          AI 角色选择
        </label>
        <div class="select-wrapper">
          <select v-model="form.skill">
            <option value="">-- 手动输入需求角色 --</option>
            <option v-for="role in globalState.roles" :key="role.id" :value="role.content">
              {{ role.name }}
            </option>
          </select>
        </div>
        <div class="preview-box" v-if="form.skill">
          {{ form.skill }}
        </div>
      </div>

      <div class="form-group">
        <label>
          <Icon icon="carbon:rule" class="header-icon" />
          开发合集与规则微调
        </label>
        <div class="select-wrapper">
          <select v-model="form.profileId">
            <option value="">-- 自定义规则 (不绑定合集) --</option>
            <option v-for="p in globalState.profiles" :key="p.id" :value="p.id">
              {{ p.name }}
            </option>
          </select>
        </div>
        
        <div class="rules-header" v-if="globalState.rules && globalState.rules.length > 0">
          <span class="rules-title">原子规则清单</span>
          <div class="rules-actions">
            <button class="text-btn" @click="selectAllRules">全选</button>
            <button class="text-btn" @click="invertRules">反选</button>
            <button class="text-btn" @click="clearRules">取消全选</button>
          </div>
        </div>

        <div class="tree-container" v-if="globalState.rules && globalState.rules.length > 0">
          <el-tree
            ref="treeRef"
            :data="treeData"
            show-checkbox
            node-key="id"
            :default-expand-all="true"
            :default-checked-keys="form.selectedRuleIds"
            @check="onTreeCheck"
          >
            <template #default="{ node, data }">
              <span class="custom-tree-node" :title="data.content">{{ node.label }}</span>
            </template>
          </el-tree>
        </div>
      </div>

      <div class="form-group">
        <label>
          <Icon icon="carbon:edit" class="header-icon" />
          开发需求 (@文件, #表结构)
        </label>
        <RichEditor
          placeholder="请输入开发任务详情..."
          :va="form.requirement"
          v-model:files="form.selectedFiles"
          v-model:tables="form.selectedTables"
          @change="(val) => (form.requirement = val)"
        />
      </div>

      <div class="form-group">
        <label>
          <Icon icon="carbon:settings-adjust" class="header-icon" />
          附加选项
        </label>
        <div class="options-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.includeFileTree" class="auto-checkbox" />
            <span class="checkbox-text">附带当前工作区文件树</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" v-model="form.enableDiff" class="auto-checkbox" />
            <span class="checkbox-text">启用 Diff/Replace 输出格式</span>
          </label>
        </div>
      </div>

      <div class="main-actions">
        <button class="btn-primary btn-generate" @click="handleGenerate" :disabled="loading">
          <Icon :icon="loading ? 'carbon:renew' : 'carbon:magic-wand'" :class="{ 'spin': loading }" />
          {{ loading ? "正在解析..." : "生成提示词" }}
        </button>
        <button class="btn-secondary" @click="applyDiff" title="从剪贴板解析并自动替换文件内容">
          <Icon icon="carbon:code" /> 解析并应用剪贴板 Diff
        </button>
      </div>
    </div>

    <div class="result-section" v-if="result">
      <div class="result-header">
        <div class="title">
          <Icon icon="carbon:document-view" /> 生成结果
        </div>
        <div class="actions">
          <button class="icon-btn" title="保存到 .ykide" @click="handleSaveFile">
            <Icon icon="carbon:save" /> 存为 MD
          </button>
          <button class="icon-btn highlight" title="复制" @click="copyResult">
            <Icon icon="carbon:copy" /> 复制
          </button>
        </div>
      </div>
      <textarea readonly v-model="result" class="result-area"></textarea>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, inject, onMounted, toRaw, watch, computed, nextTick } from "vue";
import { Icon } from '@iconify/vue'; 
import { ElTree } from "element-plus";
import "element-plus/theme-chalk/el-tree.css";
import "element-plus/theme-chalk/el-checkbox.css";
import { vscodeApi } from "../utils/vscode.js";
import RichEditor from "./RichEditor.vue";

const globalState = inject("globalState");
const loading = ref(false);
const result = ref("");
const treeRef = ref(null); // el-tree 实例引用

const form = reactive({
  skill: "", 
  profileId: "",
  selectedRuleIds: [], 
  selectedFiles: [],
  selectedTables: [],
  requirement: "",
  includeFileTree: false,
  enableDiff: true
});

const applyDiff = () => {
  vscodeApi.postMessage({ type: "applyDiffFromClipboard" });
};

// --- 将数据转换为 el-tree 支持的格式 (无 else) ---
const treeData = computed(() => {
  const groups = {};
  const rules = globalState.rules || [];

  rules.forEach((rule) => {
    const match = rule.name.match(/^\[(.*?)\]/);
    const prefix = match ? match[1] : "通用规则 (无前缀)";

    if (!groups[prefix]) {
      groups[prefix] = { id: `group_${prefix}`, label: prefix, children: [] };
    }
    groups[prefix].children.push({ id: rule.id, label: rule.name, content: rule.content });
  });

  return Object.values(groups);
});

// --- 处理 el-tree 原生勾选事件 ---
const onTreeCheck = (nodeObj, treeStatus) => {
  form.selectedRuleIds = treeStatus.checkedKeys.filter(id => !id.toString().startsWith("group_"));
  form.profileId = ""; // 退出合集状态
};

// --- 更新 Tree UI 状态 ---
const syncTreeSelection = () => {
  if (!treeRef.value) return;
  treeRef.value.setCheckedKeys(form.selectedRuleIds);
};

// --- 全选 / 反选 / 取消全选逻辑 ---
const selectAllRules = () => {
  form.selectedRuleIds = globalState.rules.map(r => r.id);
  syncTreeSelection();
  form.profileId = "";
};

const clearRules = () => {
  form.selectedRuleIds = [];
  syncTreeSelection();
  form.profileId = "";
};

const invertRules = () => {
  const currentSet = new Set(form.selectedRuleIds);
  form.selectedRuleIds = globalState.rules
    .map(r => r.id)
    .filter(id => !currentSet.has(id));
  syncTreeSelection();
  form.profileId = "";
};

// --- 联动逻辑 ---
watch(() => form.profileId, (newId) => {
  if (!newId) return;
  const profile = globalState.profiles.find((p) => p.id === newId);
  if (!profile) return;
  
  form.selectedRuleIds = [...profile.ruleIds];
  syncTreeSelection(); // 同步 UI
});

const handleGenerate = () => {
  if (!form.requirement) {
    vscodeApi.postMessage({ type: "error", value: "需求内容不能为空" });
    return;
  }
  loading.value = true;
  vscodeApi.postMessage({ type: "generate", data: toRaw(form) });
};

const copyResult = () => { vscodeApi.postMessage({ type: "copyToClipboard", value: result.value }); };

const handleSaveFile = () => {
  vscodeApi.postMessage({ type: "savePromptFile", value: result.value, files: toRaw(form.selectedFiles) });
};

onMounted(() => {
  vscodeApi.postMessage({ type: "getPromptConfig" });
  vscodeApi.onMessage((msg) => {
    if (msg.type === "promptConfigData" && msg.data) {
      Object.assign(form, msg.data);
      if (!form.selectedRuleIds) form.selectedRuleIds = [];
      // 等待 DOM 渲染完毕后同步树状态
      nextTick(() => syncTreeSelection());
    }
    if (msg.type === "renderResult") {
      result.value = msg.value;
      loading.value = false;
    }
  });
});
</script>

<style scoped>
.main-form { display: flex; flex-direction: column; gap: 16px; padding: 4px; }
.card { background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); border-radius: 6px; padding: 16px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.form-group { display: flex; flex-direction: column; gap: 8px; }

label { font-size: 12px; font-weight: 600; color: var(--vscode-foreground); display: flex; align-items: center; gap: 6px; opacity: 0.9; }
.header-icon { font-size: 14px; }

.rules-header { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
.rules-title { font-size: 11px; opacity: 0.7; }
.rules-actions { display: flex; gap: 10px; }
.text-btn { background: none; border: none; padding: 0; font-size: 11px; color: var(--vscode-textLink-foreground); cursor: pointer; opacity: 0.8; }
.text-btn:hover { opacity: 1; text-decoration: underline; }

.preview-box { background: var(--vscode-textCodeBlock-background); color: var(--vscode-descriptionForeground); padding: 8px 12px; border-radius: 4px; font-size: 11px; line-height: 1.5; border-left: 3px solid var(--vscode-textLink-foreground); white-space: pre-wrap; max-height: 120px; overflow-y: auto; }

/* --- 🌟 Tree 专属样式 --- */
.tree-container { max-height: 250px; overflow-y: auto; border: 1px solid var(--vscode-input-border); border-radius: 4px; padding: 8px; background: var(--vscode-input-background); }
.custom-tree-node { font-size: 12px; color: var(--vscode-input-foreground); }

:deep(.el-tree) { background: transparent; color: var(--vscode-input-foreground); }
:deep(.el-tree-node__content:hover) { background-color: var(--vscode-list-hoverBackground); }
:deep(.el-checkbox__inner) { background-color: var(--vscode-checkbox-background, #ffffff) !important; border: 1px solid var(--vscode-checkbox-border, #888888) !important; }
:deep(.el-checkbox__input.is-checked .el-checkbox__inner), :deep(.el-checkbox__input.is-indeterminate .el-checkbox__inner) { background-color: var(--vscode-button-background, #007acc) !important; border-color: var(--vscode-button-background, #007acc) !important; }
:deep(.el-checkbox__inner::after) { border-color: var(--vscode-checkbox-foreground, #ffffff) !important; }
:deep(.el-checkbox__inner::before) { background-color: var(--vscode-checkbox-foreground, #ffffff) !important; }

select { width: 100%; box-sizing: border-box; padding: 8px 12px; font-family: var(--vscode-font-family); font-size: 13px; background: var(--vscode-select-background); color: var(--vscode-select-foreground); border: 1px solid var(--vscode-select-border); border-radius: 4px; cursor: pointer; outline: none; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23cccccc' d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; }
.btn-primary { padding: 10px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; transition: filter 0.2s; }
.btn-primary:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
.btn-primary:disabled { opacity: 0.6; cursor: wait; }
.result-section { display: flex; flex-direction: column; gap: 8px; animation: slideUp 0.3s ease-out; }
.result-header { display: flex; justify-content: space-between; align-items: center; }
.result-header .title { font-size: 12px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.actions { display: flex; gap: 8px; }
.icon-btn { background: transparent; border: 1px solid var(--vscode-panel-border); color: var(--vscode-foreground); padding: 4px 8px; font-size: 11px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
.icon-btn.highlight { border-color: var(--vscode-button-background); color: var(--vscode-button-background); }
.result-area { width: 100%; min-height: 350px; background: var(--vscode-textCodeBlock-background); color: var(--vscode-editor-foreground); border: 1px solid var(--vscode-widget-border); border-radius: 4px; font-family: var(--vscode-editor-font-family); font-size: 12px; padding: 12px; resize: vertical; line-height: 1.5; }
.spin { animation: spin 1s linear infinite; }
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
select:focus { border-color: var(--vscode-focusBorder); }
select option { background-color: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); padding: 8px; font-size: 13px; }
select option:disabled { color: var(--vscode-disabledForeground); opacity: 0.5; }
select:hover { border-color: var(--vscode-settings-dropdownListBorder) || var(--vscode-button-background); }
.select-wrapper { position: relative; width: 100%; }

/* 新增的动作区域及附加选项样式 */
.main-actions { display: flex; flex-direction: column; gap: 8px; }
.btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); padding: 10px; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 600; transition: opacity 0.2s; }
.btn-secondary:hover { opacity: 0.8; }
.options-group { display: flex; flex-direction: column; gap: 8px; background: var(--vscode-input-background); padding: 10px; border-radius: 4px; border: 1px solid var(--vscode-input-border); }
.checkbox-label { display: flex; align-items: flex-start; gap: 6px; cursor: pointer; }
.auto-checkbox { width: auto; margin: 2px 0 0 0; cursor: pointer; }
.checkbox-text { font-size: 12px; user-select: none; line-height: 1.4; }
</style>
