<template>
  <div class="setting-section">
    <button class="btn-dashed full-width" v-if="!isAdding" @click="toggleAdd(true)">
      <Icon icon="carbon:add" /> 新增角色
    </button>

    <div class="add-form" v-if="isAdding">
      <input type="text" v-model="addForm.name" placeholder="角色名称" />
      <textarea v-model="addForm.content" placeholder="角色的 System Prompt 设定..."></textarea>
      <div class="btn-group">
        <button class="btn-primary" @click="submitAdd">保存</button>
        <button class="btn-secondary" @click="toggleAdd(false)">取消</button>
      </div>
    </div>

    <div class="list-container">
      <div class="list-item-wrapper" v-for="role in globalState.roles" :key="role.id">
        <div class="list-item-header" @click="toggleExpand(role.id)">
          <span class="item-name">{{ role.name }}</span>
          <Icon :icon="expandedId === role.id ? 'carbon:chevron-up' : 'carbon:chevron-down'" />
        </div>

        <div class="list-item-body" v-if="expandedId === role.id">
          <div v-if="editingId !== role.id">
            <p class="preview-text">{{ role.content || "暂无提示词设定" }}</p>
            <div class="action-bar">
              <span class="action-btn" @click="startEdit(role)"><Icon icon="carbon:edit" /> 编辑</span>
              <span class="action-btn danger" @click="deleteItem(role.id)"><Icon icon="carbon:trash-can" /> 删除</span>
            </div>
          </div>
          
          <div class="edit-form" v-if="editingId === role.id">
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
const isAdding = ref(false);
const expandedId = ref(null);
const editingId = ref(null);

const addForm = reactive({ name: "", content: "" });
const editForm = reactive({ id: "", name: "", content: "" });

const toggleAdd = (val) => {
  isAdding.value = val;
  addForm.name = "";
  addForm.content = "";
};

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id;
  editingId.value = null;
};

const startEdit = (item) => {
  editingId.value = item.id;
  editForm.id = item.id;
  editForm.name = item.name;
  editForm.content = item.content || "";
};

const cancelEdit = () => { editingId.value = null; };

const submitAdd = () => {
  if (!addForm.name.trim()) {
    vscodeApi.postMessage({ type: "error", value: "名称不能为空" });
    return;
  }
  const payload = { id: `role_${Date.now()}`, name: addForm.name.trim(), content: addForm.content.trim() };
  vscodeApi.postMessage({ type: "saveRole", data: payload });
  toggleAdd(false);
};

const submitEdit = () => {
  if (!editForm.name.trim()) {
    vscodeApi.postMessage({ type: "error", value: "名称不能为空" });
    return;
  }
  vscodeApi.postMessage({ type: "saveRole", data: { ...editForm } });
  editingId.value = null;
};

const deleteItem = (id) => {
  vscodeApi.postMessage({ type: "deleteRole", roleId: id });
  expandedId.value = null;
};
</script>

<style scoped lang="scss">
@use "../SettingsPanel.scss";
</style>