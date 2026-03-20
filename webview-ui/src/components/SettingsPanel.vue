<template>
  <div class="settings-panel">
    <div class="global-action-bar">
      <span class="view-title">全局配置管理</span>
      <span
        class="iconify icon-btn"
        data-icon="carbon:document-export"
        title="导出当前所有配置到 .ykide 文件夹"
        @click="exportSettings"
      ></span>
    </div>

    <div class="sub-tabs">
      <div
        :class="['tab-item', { active: activeTab === 'role' }]"
        @click="activeTab = 'role'"
      >
        <span
          class="iconify"
          data-icon="carbon:user-role"
        ></span>
        角色
      </div>
      <div
        :class="['tab-item', { active: activeTab === 'rule' }]"
        @click="activeTab = 'rule'"
      >
        <span
          class="iconify"
          data-icon="carbon:rule"
        ></span>
        规则
      </div>
      <div
        :class="['tab-item', { active: activeTab === 'profile' }]"
        @click="activeTab = 'profile'"
      >
        <span
          class="iconify"
          data-icon="carbon:category"
        ></span>
        规范
      </div>
    </div>

    <div class="tab-content">
      <!-- 1. 角色管理 -->
      <div
        v-if="activeTab === 'role'"
        class="setting-section"
      >
        <button
          class="btn-dashed full-width"
          v-if="activeAddMenu !== 'role'"
          @click="toggleAdd('role')"
        >
          <span
            class="iconify"
            data-icon="carbon:add"
          ></span>
          新增 AI 角色
        </button>

        <div
          class="add-form"
          v-if="activeAddMenu === 'role'"
        >
          <input
            type="text"
            v-model="addForms.role.name"
            placeholder="角色名称"
          />
          <textarea
            v-model="addForms.role.content"
            placeholder="角色的 System Prompt 设定..."
          ></textarea>
          <div class="btn-group">
            <button
              class="btn-primary"
              @click="submitAdd('role')"
            >
              保存
            </button>
            <button
              class="btn-secondary"
              @click="toggleAdd(null)"
            >
              取消
            </button>
          </div>
        </div>

        <div class="list-container">
          <div
            class="list-item-wrapper"
            v-for="role in globalState.roles"
            :key="role.id"
          >
            <div
              class="list-item-header"
              @click="toggleExpand(role.id)"
            >
              <span class="item-name">{{ role.name }}</span>
              <span
                class="iconify"
                :data-icon="
                  expandedId === role.id
                    ? 'carbon:chevron-up'
                    : 'carbon:chevron-down'
                "
              ></span>
            </div>
            <div
              class="list-item-body"
              v-if="expandedId === role.id"
            >
              <div v-if="editingId !== role.id">
                <p class="preview-text">
                  {{ role.content || "暂无提示词设定" }}
                </p>
                <div class="action-bar">
                  <span
                    class="action-btn"
                    @click="startEdit('role', role)"
                    ><span
                      class="iconify"
                      data-icon="carbon:edit"
                    ></span>
                    编辑</span
                  >
                  <span
                    class="action-btn danger"
                    @click="deleteItem('deleteRole', role.id)"
                    ><span
                      class="iconify"
                      data-icon="carbon:trash-can"
                    ></span>
                    删除</span
                  >
                </div>
              </div>
              <div
                class="edit-form"
                v-if="editingId === role.id"
              >
                <input
                  type="text"
                  v-model="editForms.role.name"
                />
                <textarea v-model="editForms.role.content"></textarea>
                <div class="btn-group">
                  <button
                    class="btn-primary"
                    @click="submitEdit('role')"
                  >
                    更新
                  </button>
                  <button
                    class="btn-secondary"
                    @click="cancelEdit"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. 规则管理 -->
      <div
        v-if="activeTab === 'rule'"
        class="setting-section"
      >
        <button
          class="btn-dashed full-width"
          v-if="activeAddMenu !== 'rule'"
          @click="toggleAdd('rule')"
        >
          <span
            class="iconify"
            data-icon="carbon:add"
          ></span>
          新增原子规则
        </button>

        <div
          class="add-form"
          v-if="activeAddMenu === 'rule'"
        >
          <!-- 新增：规则前缀单选框 -->
          <p class="sub-label">规则分类前缀：</p>
          <div class="radio-group">
            <label
              v-for="p in fileTypes"
              :key="p"
              class="radio-label"
            >
              <input
                type="radio"
                :value="p"
                v-model="addForms.rule.prefix"
              />
              <span>{{ p }}</span>
            </label>
          </div>

          <input
            type="text"
            v-model="addForms.rule.name"
            placeholder="规则名称 (例: 代码优化规范)"
          />
          <textarea
            v-model="addForms.rule.content"
            placeholder="具体的 Prompt 内容描述..."
          ></textarea>
          <div class="btn-group">
            <button
              class="btn-primary"
              @click="submitAdd('rule')"
            >
              保存
            </button>
            <button
              class="btn-secondary"
              @click="toggleAdd(null)"
            >
              取消
            </button>
          </div>
        </div>

        <div class="list-container">
          <div
            class="list-item-wrapper"
            v-for="rule in globalState.rules"
            :key="rule.id"
          >
            <div
              class="list-item-header"
              @click="toggleExpand(rule.id)"
            >
              <span class="item-name">{{ rule.name }}</span>
              <span
                class="iconify"
                :data-icon="
                  expandedId === rule.id
                    ? 'carbon:chevron-up'
                    : 'carbon:chevron-down'
                "
              ></span>
            </div>
            <div
              class="list-item-body"
              v-if="expandedId === rule.id"
            >
              <div v-if="editingId !== rule.id">
                <p class="preview-text">{{ rule.content }}</p>
                <div class="action-bar">
                  <span
                    class="action-btn"
                    @click="startEdit('rule', rule)"
                    ><span
                      class="iconify"
                      data-icon="carbon:edit"
                    ></span>
                    编辑</span
                  >
                  <span
                    class="action-btn danger"
                    @click="deleteItem('deleteRule', rule.id)"
                    ><span
                      class="iconify"
                      data-icon="carbon:trash-can"
                    ></span>
                    删除</span
                  >
                </div>
              </div>
              <div
                class="edit-form"
                v-if="editingId === rule.id"
              >
                <!-- 编辑时也提供前缀选择（可选，如果不需要编辑时改前缀可删掉这部分） -->
                <div class="radio-group">
                  <label
                    v-for="p in fileTypes"
                    :key="p"
                    class="radio-label"
                  >
                    <input
                      type="radio"
                      :value="p"
                      v-model="editForms.rule.prefix"
                    />
                    <span>{{ p }}</span>
                  </label>
                </div>
                <input
                  type="text"
                  v-model="editForms.rule.name"
                />
                <textarea v-model="editForms.rule.content"></textarea>
                <div class="btn-group">
                  <button
                    class="btn-primary"
                    @click="submitEdit('rule')"
                  >
                    更新
                  </button>
                  <button
                    class="btn-secondary"
                    @click="cancelEdit"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. 规范管理 -->
      <div
        v-if="activeTab === 'profile'"
        class="setting-section"
      >
        <button
          class="btn-dashed full-width"
          v-if="activeAddMenu !== 'profile'"
          @click="toggleAdd('profile')"
        >
          <span
            class="iconify"
            data-icon="carbon:add"
          ></span>
          新增组合规范
        </button>

        <div
          class="add-form"
          v-if="activeAddMenu === 'profile'"
        >
          <input
            type="text"
            v-model="addForms.profile.name"
            placeholder="规范名称"
          />
          <p class="sub-label">勾选包含的原子规则：</p>
          <div class="checkbox-group">
            <label
              class="checkbox-label"
              v-for="rule in globalState.rules"
              :key="'add-cb-' + rule.id"
              :title="rule.content"
            >
              <!-- 修复 1：添加 :title="rule.content" 实现悬停显示 -->
              <input
                type="checkbox"
                :value="rule.id"
                v-model="addForms.profile.ruleIds"
                class="auto-checkbox"
              />
              <span class="checkbox-text">{{ rule.name }}</span>
            </label>
          </div>
          <div
            class="btn-group"
            style="margin-top: 8px"
          >
            <button
              class="btn-primary"
              @click="submitAdd('profile')"
            >
              保存
            </button>
            <button
              class="btn-secondary"
              @click="toggleAdd(null)"
            >
              取消
            </button>
          </div>
        </div>

        <div class="list-container">
          <div
            class="list-item-wrapper"
            v-for="profile in globalState.profiles"
            :key="profile.id"
          >
            <div
              class="list-item-header"
              @click="toggleExpand(profile.id)"
            >
              <span class="item-name"
                >{{ profile.name }} ({{ profile.ruleIds.length }}项)</span
              >
              <span
                class="iconify"
                :data-icon="
                  expandedId === profile.id
                    ? 'carbon:chevron-up'
                    : 'carbon:chevron-down'
                "
              ></span>
            </div>
            <div
              class="list-item-body"
              v-if="expandedId === profile.id"
            >
              <div v-if="editingId !== profile.id">
                <ul class="preview-list">
                  <li
                    v-for="ruleId in profile.ruleIds"
                    :key="ruleId"
                  >
                    • {{ getRuleName(ruleId) }}
                  </li>
                </ul>
                <div class="action-bar">
                  <span
                    class="action-btn"
                    @click="startEdit('profile', profile)"
                    ><span
                      class="iconify"
                      data-icon="carbon:edit"
                    ></span>
                    编辑</span
                  >
                  <span
                    class="action-btn danger"
                    @click="deleteItem('deleteProfile', profile.id)"
                    ><span
                      class="iconify"
                      data-icon="carbon:trash-can"
                    ></span>
                    删除</span
                  >
                </div>
              </div>
              <div
                class="edit-form"
                v-if="editingId === profile.id"
              >
                <input
                  type="text"
                  v-model="editForms.profile.name"
                />
                <div class="checkbox-group">
                  <label
                    class="checkbox-label"
                    v-for="rule in globalState.rules"
                    :key="'edit-cb-' + rule.id"
                    :title="rule.content"
                  >
                    <!-- 修复 1：编辑模式下也加上悬停提示 -->
                    <input
                      type="checkbox"
                      :value="rule.id"
                      v-model="editForms.profile.ruleIds"
                      class="auto-checkbox"
                    />
                    <span class="checkbox-text">{{ rule.name }}</span>
                  </label>
                </div>
                <div
                  class="btn-group"
                  style="margin-top: 8px"
                >
                  <button
                    class="btn-primary"
                    @click="submitEdit('profile')"
                  >
                    更新
                  </button>
                  <button
                    class="btn-secondary"
                    @click="cancelEdit"
                  >
                    取消
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, inject, ref } from "vue";
import { vscodeApi } from "../utils/vscode.js";

const globalState = inject("globalState");
const activeTab = ref("role");
const activeAddMenu = ref(null);
const expandedId = ref(null);
  const editingId = ref(null);

  const fileTypes = ['无', 'vue', 'js', 'php','java', 'uni', 'md'];

// 表单数据绑定
const addForms = reactive({
  role: { name: "", content: "" },
  rule: { name: "", content: "", prefix: "无" }, // 新增 prefix
  profile: { name: "", ruleIds: [] },
});

const editForms = reactive({
  role: { id: "", name: "", content: "" },
  rule: { id: "", name: "", content: "", prefix: "无" }, // 新增 prefix
  profile: { id: "", name: "", ruleIds: [] },
});

const toggleAdd = (menu) => {
  activeAddMenu.value = menu;
  if (menu) {
    addForms[menu].name = "";
    addForms[menu].content = "";
    if (menu === "rule") addForms.rule.prefix = "无"; // 重置单选
    if (menu === "profile") addForms[menu].ruleIds = [];
  }
};

const toggleExpand = (id) => {
  expandedId.value = expandedId.value === id ? null : id;
  editingId.value = null;
};

const startEdit = (type, item) => {
  editingId.value = item.id;
  editForms[type].id = item.id;

  // 逻辑：如果名称带有 [xxx]，尝试解析回 prefix (可选优化)
  if (type === "rule") {
    const match = item.name.match(/^\[(.*?)\]\s*/);
    if (match && ["vue", "js", "java", "uni", "md"].includes(match[1])) {
      editForms.rule.prefix = match[1];
      editForms.rule.name = item.name.replace(/^\[.*?\]\s*/, "");
    } else {
      editForms.rule.prefix = "无";
      editForms.rule.name = item.name;
    }
  } else {
    editForms[type].name = item.name;
  }

  if (type !== "profile") editForms[type].content = item.content || "";
  if (type === "profile") editForms[type].ruleIds = [...item.ruleIds];
};

const cancelEdit = () => {
  editingId.value = null;
};

const getRuleName = (ruleId) => {
  const rule = globalState.rules.find((r) => r.id === ruleId);
  return rule ? rule.name : "未知规则";
};

// ========================
// 业务请求逻辑
// ========================
const submitAdd = (type) => {
  const form = addForms[type];
  if (!form.name.trim()) {
    vscodeApi.postMessage({ type: "error", value: "名称不能为空" });
    return;
  }

  // 核心逻辑：拼装名称
  let finalName = form.name.trim();
  if (type === "rule" && form.prefix !== "无") {
    finalName = `[${form.prefix}] ${finalName}`;
  }

  const payload = { id: `${type}_${Date.now()}`, name: finalName };
  if (type !== "profile") payload.content = form.content.trim();
  if (type === "profile") payload.ruleIds = [...form.ruleIds];

  vscodeApi.postMessage({ type: `save${capitalize(type)}`, data: payload });
  toggleAdd(null);
};

const submitEdit = (type) => {
  const form = editForms[type];
  if (!form.name.trim()) {
    vscodeApi.postMessage({ type: "error", value: "名称不能为空" });
    return;
  }

  // 核心逻辑：拼装名称
  let finalName = form.name.trim();
  if (type === "rule" && form.prefix !== "无") {
    finalName = `[${form.prefix}] ${finalName}`;
  }

  const payload = { id: form.id, name: finalName };
  if (type !== "profile") payload.content = form.content.trim();
  if (type === "profile") payload.ruleIds = [...form.ruleIds];

  vscodeApi.postMessage({ type: `save${capitalize(type)}`, data: payload });
  editingId.value = null;
};

const deleteItem = (command, id) => {
  vscodeApi.postMessage({
    type: command,
    [`${command.replace("delete", "").toLowerCase()}Id`]: id,
  });
  expandedId.value = null;
};

const exportSettings = () => {
  vscodeApi.postMessage({ type: "exportSettings" });
};
const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
</script>

<style scoped>
.settings-panel { display: flex; flex-direction: column; height: 100%; }

/* 全局顶部栏 */
.global-action-bar { display: flex; justify-content: space-between; align-items: center; padding: 4px 0 10px 0; }
.view-title { font-size: 14px; font-weight: 600; color: var(--vscode-sideBarTitle-foreground); }
.icon-btn { cursor: pointer; font-size: 16px; opacity: 0.7; transition: opacity 0.2s; color: var(--vscode-foreground); }
.icon-btn:hover { opacity: 1; color: var(--vscode-textLink-foreground); }

/* 子导航 Tabs */
.sub-tabs { display: flex; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 15px; }
.tab-item { flex: 1; text-align: center; padding: 6px 0; font-size: 12px; cursor: pointer; opacity: 0.6; display: flex; align-items: center; justify-content: center; gap: 4px; border-bottom: 2px solid transparent; transition: all 0.2s; }
.tab-item:hover { opacity: 1; background: var(--vscode-list-hoverBackground); }
.tab-item.active { opacity: 1; border-bottom-color: var(--vscode-activityBar-activeBorder); color: var(--vscode-activityBar-activeBorder); font-weight: bold; }

.tab-content { flex: 1; display: flex; flex-direction: column; gap: 10px; }
.setting-section { display: flex; flex-direction: column; gap: 10px; }

/* 虚线添加按钮 */
.btn-dashed { padding: 8px; border: 1px dashed var(--vscode-panel-border); background: transparent; color: var(--vscode-descriptionForeground); cursor: pointer; display: flex; justify-content: center; align-items: center; gap: 6px; font-size: 12px; border-radius: 4px; transition: all 0.2s; }
.btn-dashed:hover { border-color: var(--vscode-textLink-foreground); color: var(--vscode-textLink-foreground); background: var(--vscode-editor-background); }

/* 表单与输入框 */
.add-form, .edit-form { display: flex; flex-direction: column; gap: 8px; padding: 10px; background: var(--vscode-editorWidget-background); border: 1px solid var(--vscode-widget-border); border-radius: 4px; margin-bottom: 8px; }
input, textarea { width: 100%; box-sizing: border-box; padding: 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 2px; outline: none; font-size: 12px; }
textarea { resize: vertical; min-height: 70px; }
.sub-label { font-size: 11px; margin: 0; opacity: 0.7; }

/* 按钮组 */
.btn-group { display: flex; gap: 8px; }
.btn-primary, .btn-secondary { flex: 1; padding: 6px; border: none; cursor: pointer; border-radius: 2px; display: flex; justify-content: center; align-items: center; gap: 4px; font-size: 12px; }
.btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
.btn-primary:hover { background: var(--vscode-button-hoverBackground); }
.btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-button-secondaryBackground); }
.btn-secondary:hover { opacity: 0.8; }
.full-width { width: 100%; }

/* 折叠列表样式 */
.list-container { display: flex; flex-direction: column; gap: 6px; }
.list-item-wrapper { background: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); border-radius: 4px; overflow: hidden; }
.list-item-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; cursor: pointer; user-select: none; transition: background 0.2s; }
.list-item-header:hover { background: var(--vscode-list-hoverBackground); }
.item-name { font-size: 12px; font-weight: 500; }
.list-item-body { padding: 10px; border-top: 1px dashed var(--vscode-panel-border); background: var(--vscode-sideBar-background); }

/* 预览视图 */
.preview-text { font-size: 11px; color: var(--vscode-descriptionForeground); white-space: pre-wrap; margin: 0 0 10px 0; max-height: 150px; overflow-y: auto; }
.preview-list { margin: 0 0 10px 0; padding-left: 0; list-style: none; font-size: 11px; color: var(--vscode-descriptionForeground); }
.preview-list li { margin-bottom: 4px; }
.action-bar { display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid var(--vscode-widget-border); padding-top: 8px; }
.action-btn { font-size: 11px; cursor: pointer; display: flex; align-items: center; gap: 4px; opacity: 0.8; transition: opacity 0.2s; }
.action-btn:hover { opacity: 1; color: var(--vscode-textLink-foreground); }
.action-btn.danger:hover { color: #ef4444; }

/* Checkbox 对齐 */
.checkbox-group { display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto; padding: 4px; background: var(--vscode-input-background); border: 1px solid var(--vscode-input-border); }
.checkbox-label { display: flex; align-items: flex-start; gap: 6px; cursor: pointer; }
.auto-checkbox { width: auto; margin: 2px 0 0 0; cursor: pointer; }
.checkbox-text { font-size: 12px; user-select: none; line-height: 1.4; }


.sub-label { font-size: 11px; margin: 0 0 4px 0; opacity: 0.7; }

.radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
  padding: 8px;
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border);
  border-radius: 2px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  cursor: pointer;
  opacity: 0.8;
}
.radio-label:hover {
  opacity: 1;
}
.radio-label input {
  width: auto;
  margin: 0;
  cursor: pointer;
}

/* 确保 tooltip 能够正常工作并提示用户 */
.checkbox-label {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  cursor: help; /* 鼠标变为帮助样式，暗示有悬停内容 */
  padding: 2px 4px;
  border-radius: 2px;
}
.checkbox-label:hover {
  background: var(--vscode-list-hoverBackground);
}
</style>