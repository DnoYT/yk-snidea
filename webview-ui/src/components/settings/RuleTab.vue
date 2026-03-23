<template>
  <div class="setting-section">
    <button class="btn-dashed full-width" v-if="!isAdding" @click="toggleAdd(true)">
      <Icon icon="carbon:add" /> 新增原子规则
    </button>

    <div class="add-form" v-if="isAdding">
      <p class="sub-label">规则分类前缀：</p>
      <div class="radio-group">
        <label v-for="p in fileTypes" :key="p" class="radio-label">
          <input type="radio" :value="p" v-model="addForm.prefix" />
          <span>{{ p }}</span>
        </label>
      </div>
      <input type="text" v-model="addForm.name" placeholder="规则名称 (例: 代码优化规范)" />
      <textarea v-model="addForm.content" placeholder="具体的 Prompt 内容描述..."></textarea>
      <div class="btn-group">
        <button class="btn-primary" @click="submitAdd">保存</button>
        <button class="btn-secondary" @click="toggleAdd(false)">取消</button>
      </div>
    </div>

    <div class="list-container">
      <div class="list-item-wrapper" v-for="rule in globalState.rules" :key="rule.id">
        <div class="list-item-header" @click="toggleExpand(rule.id)">
          <span class="item-name">{{ rule.name }}</span>
          <Icon :icon="expandedId === rule.id ? 'carbon:chevron-up' : 'carbon:chevron-down'" />
        </div>

        <div class="list-item-body" v-if="expandedId === rule.id">
          <div v-if="editingId !== rule.id">
            <p class="preview-text">{{ rule.content }}</p>
            <div class="action-bar">
              <span class="action-btn" @click="startEdit(rule)"><Icon icon="carbon:edit" /> 编辑</span>
              <span class="action-btn danger" @click="deleteItem(rule.id)"><Icon icon="carbon:trash-can" /> 删除</span>
            </div>
          </div>

          <div class="edit-form" v-if="editingId === rule.id">
            <div class="radio-group">
              <label v-for="p in fileTypes" :key="p" class="radio-label">
                <input type="radio" :value="p" v-model="editForm.prefix" />
                <span>{{ p }}</span>
              </label>
            </div>
            <input type="text" v-model="editForm.name" />
            <textarea v-model="editForm.content"></textarea>
            <div class="btn-group">
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
import { reactive, ref, inject } from "vue";
import { Icon } from "@iconify/vue";
import { vscodeApi } from "../../utils/vscode.js";

const globalState = inject("globalState");
const fileTypes = ['无', 'vue', 'js', 'php','java', 'uni', 'md', 'sql'];

const isAdding = ref(false);
const expandedId = ref(null);
const editingId = ref(null);

const addForm = reactive({ name: "", content: "", prefix: "无" });
const editForm = reactive({ id: "", name: "", content: "", prefix: "无" });

const toggleAdd = (val) => {
  isAdding.value = val;
  addForm.name = ""; addForm.content = ""; addForm.prefix = "无";
};

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id;
  editingId.value = null;
};

const startEdit = (item) => {
  editingId.value = item.id;
  editForm.id = item.id;
  editForm.content = item.content || "";

  // 严格遵循 Early Return 的前缀解析
  const match = item.name.match(/^\[(.*?)\]\s*/);
  if (match && fileTypes.includes(match[1])) {
    editForm.prefix = match[1];
    editForm.name = item.name.replace(/^\[.*?\]\s*/, "");
    return;
  }

  editForm.prefix = "无";
  editForm.name = item.name;
};

const cancelEdit = () => { editingId.value = null; };

const submitAdd = () => {
  if (!addForm.name.trim()) {
    vscodeApi.postMessage({ type: "error", value: "名称不能为空" });
    return;
  }
  let finalName = addForm.name.trim();
  if (addForm.prefix !== "无") finalName = `[${addForm.prefix}] ${finalName}`;

  const payload = { id: `rule_${Date.now()}`, name: finalName, content: addForm.content.trim() };
  vscodeApi.postMessage({ type: "saveRule", data: payload });
  toggleAdd(false);
};

const submitEdit = () => {
  if (!editForm.name.trim()) {
    vscodeApi.postMessage({ type: "error", value: "名称不能为空" });
    return;
  }
  let finalName = editForm.name.trim();
  if (editForm.prefix !== "无") finalName = `[${editForm.prefix}] ${finalName}`;

  vscodeApi.postMessage({ type: "saveRule", data: { id: editForm.id, name: finalName, content: editForm.content.trim() } });
  editingId.value = null;
};

const deleteItem = (id) => {
  vscodeApi.postMessage({ type: "deleteRule", ruleId: id });
  expandedId.value = null;
};
</script>

<style scoped lang="scss">
@use "../SettingsPanel.scss";
</style>