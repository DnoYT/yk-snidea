<template>
  <div class="app-container">
    <div class="form-group">
      <label>技能与角色</label>
      <select v-model="form.skills">
        <option value="前端开发专家">前端开发专家</option>
        <option value="后端开发专家">后端开发专家</option>
      </select>
    </div>

    <div class="form-group">
      <label>开发规范</label>
      <select v-model="form.rules">
        <option value="默认通用规范">默认规范 (无 else 规范)</option>
      </select>
    </div>

    <div class="form-group">
      <label>数据库参考</label>
      <input
        type="text"
        v-model="form.dbInfo"
        placeholder="例如: user_table"
      />
    </div>

    <div class="form-group">
      <label>本次开发需求 (输入 @ 搜索文件)</label>

      <div class="tags-container">
        <div
          v-for="(file, index) in selectedFiles"
          :key="file.fsPath"
          class="file-tag"
          :title="file.relativePath"
        >
          <span
            class="tag-name"
            @click="openFile(file.fsPath)"
          >
            <span
              class="iconify"
              data-icon="carbon:document"
            ></span>
            {{ getDisplayName(file) }}
          </span>
          <span
            class="iconify remove-icon"
            data-icon="carbon:close"
            @click="removeTag(index)"
          ></span>
        </div>
      </div>

      <div class="editor-wrapper">
        <ul
          v-if="showDropdown"
          class="dropdown-list active"
        >
          <li
            v-for="(file, index) in searchResults"
            :key="file.fsPath"
            :class="['dropdown-item', { highlight: index === activeIndex }]"
            @mousedown.prevent="selectFile(file)"
          >
            <span class="file-name">{{
              file.relativePath.split("/").pop()
            }}</span>
            <span class="file-path">{{ file.relativePath }}</span>
          </li>
        </ul>

        <div
          id="requirement"
          ref="editor"
          contenteditable="true"
          data-placeholder="描述需求，输入 @ 文件名..."
          @input="onInput"
          @keydown="onKeyDown"
        ></div>
      </div>
    </div>

    <div class="btn-group">
      <button
        id="btn-generate"
        @click="generate"
      >
        <span
          class="iconify"
          data-icon="carbon:magic-wand"
        ></span
        >生成提示词
      </button>
    </div>

    <div class="form-group">
      <textarea
        id="result-area"
        v-model="generatedResult"
        readonly
        placeholder="点击上方按钮生成..."
      ></textarea>
    </div>

    <div class="btn-group">
      <button
        class="btn-secondary"
        @click="copyResult"
      >
        一键复制
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from "vue";
import { vscodeApi } from "./utils/vscode.js";

// 响应式状态
const form = reactive({
  skills: "前端开发专家",
  rules: "默认通用规范",
  dbInfo: "",
  requirement: "",
});
const selectedFiles = ref([]);
const searchResults = ref([]);
const showDropdown = ref(false);
const activeIndex = ref(0);
const generatedResult = ref("");
const editor = ref(null);

/**
 * 获取 Tag 显示名称 (处理同名文件，无 else)
 */
const getDisplayName = (file) => {
  const fileName = file.relativePath.split("/").pop();
  const sameNames = selectedFiles.value.filter(
    (f) => f.relativePath.split("/").pop() === fileName,
  );

  let displayName = fileName;
  if (sameNames.length > 1) {
    const parts = file.relativePath.split("/");
    if (parts.length > 1) {
      displayName = `${parts[parts.length - 2]}/${fileName}`;
    }
  }
  return displayName;
};

/**
 * 处理富文本框输入事件 (无 else)
 */
const onInput = () => {
  const selection = window.getSelection();
  if (!selection.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;

  if (textNode.nodeType !== Node.TEXT_NODE) {
    showDropdown.value = false;
    return;
  }

  const textBeforeCursor = textNode.textContent.slice(0, range.startOffset);
  const match = textBeforeCursor.match(/@([^\s]*)$/);

  if (!match) {
    showDropdown.value = false;
    return;
  }

  vscodeApi.postMessage({ type: "searchFiles", keyword: match[1] });
};

/**
 * 键盘导航逻辑 (无 else)
 */
const onKeyDown = (e) => {
  if (!showDropdown.value) {
    return;
  }

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % searchResults.value.length;
    return;
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value =
      (activeIndex.value - 1 + searchResults.value.length) %
      searchResults.value.length;
    return;
  }

  if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    const file = searchResults.value[activeIndex.value];
    if (file) {
      selectFile(file);
    }
    return;
  }
};

/**
 * 选择下拉列表文件并插入 Tag (无 else)
 */
const selectFile = (file) => {
  const isExist = selectedFiles.value.some((f) => f.fsPath === file.fsPath);
  if (!isExist) {
    selectedFiles.value.push(file);
  }

  const selection = window.getSelection();
  if (!selection.rangeCount) {
    return;
  }

  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;
  if (textNode.nodeType !== Node.TEXT_NODE) {
    return;
  }

  const textBeforeCursor = textNode.textContent.slice(0, range.startOffset);
  const atIndex = textBeforeCursor.lastIndexOf("@");
  if (atIndex === -1) {
    return;
  }

  range.setStart(textNode, atIndex);
  range.setEnd(textNode, range.startOffset);
  range.deleteContents();

  const tagSpan = document.createElement("span");
  tagSpan.className = "inline-file-tag";
  tagSpan.contentEditable = "false";
  tagSpan.innerHTML = `<span class="iconify" data-icon="carbon:document"></span> ${file.relativePath.split("/").pop()}`;

  range.insertNode(tagSpan);

  const space = document.createTextNode("\u00A0");
  tagSpan.parentNode.insertBefore(space, tagSpan.nextSibling);
  range.setStartAfter(space);
  selection.removeAllRanges();
  selection.addRange(range);

  showDropdown.value = false;

  nextTick(() => {
    if (window.Iconify) {
      window.Iconify.scan();
    }
  });
};

const removeTag = (index) => {
  selectedFiles.value.splice(index, 1);
};

const openFile = (fsPath) => {
  vscodeApi.postMessage({ type: "openFile", path: fsPath });
};

const generate = () => {
  vscodeApi.postMessage({
    type: "generate",
    data: {
      skills: form.skills,
      rules: form.rules,
      dbInfo: form.dbInfo,
      files: selectedFiles.value.map((f) => f.fsPath),
      requirement: editor.value.innerText,
    },
  });
};

const copyResult = async () => {
  if (!generatedResult.value) {
    return;
  }
  try {
    await navigator.clipboard.writeText(generatedResult.value);
    vscodeApi.postMessage({ type: "info", value: "复制成功！" });
  } catch (err) {
    vscodeApi.postMessage({ type: "error", value: "复制失败" });
  }
};

onMounted(() => {
  vscodeApi.onMessage((msg) => {
    if (msg.type === "searchResults") {
      searchResults.value = msg.files;
      showDropdown.value = true;
      activeIndex.value = 0;
      return;
    }

    if (msg.type === "renderResult") {
      generatedResult.value = msg.value;
      return;
    }
  });
});
</script>

<style>
body {
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  background-color: var(--vscode-sideBar-background);
  padding: 0;
}
</style>

<style scoped>
.app-container {
  padding: 15px 10px;
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-font-family);
  background-color: var(--vscode-sideBar-background);
}

.form-group {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vscode-sideBarTitle-foreground);
}
input,
select {
  width: 100%;
  box-sizing: border-box;
  padding: 6px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 2px;
  outline: none;
}
.btn-group {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
button {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  border: none;
  cursor: pointer;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
.btn-secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

/* --- 顶部全局 Tag 样式 --- */
.tags-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 5px;
}
.file-tag {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 4px;
  font-size: 11px;
}
.tag-name {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}
.tag-name:hover {
  text-decoration: underline;
}
.remove-icon {
  cursor: pointer;
  opacity: 0.7;
  margin-left: 4px;
}
.remove-icon:hover {
  opacity: 1;
  color: #ef4444;
}

/* --- 下拉列表样式 --- */
.editor-wrapper {
  position: relative;
  width: 100%;
}
.dropdown-list {
  display: none;
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  max-height: 150px;
  overflow-y: auto;
  background: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  margin-bottom: 4px;
  padding: 0;
  list-style: none;
}
.dropdown-list.active {
  display: block;
}
.dropdown-item {
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  color: var(--vscode-dropdown-foreground);
  font-size: 12px;
}
.dropdown-item:hover,
.dropdown-item.highlight {
  background: var(--vscode-list-hoverBackground);
  color: var(--vscode-list-activeSelectionForeground);
}
.dropdown-item .file-name {
  font-weight: bold;
}
.dropdown-item .file-path {
  opacity: 0.6;
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- 富文本输入框与行内 Tag 样式 --- */
#requirement {
  width: 100%;
  min-height: 80px;
  box-sizing: border-box;
  padding: 6px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 2px;
  outline: none;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
#requirement:empty:before {
  content: attr(data-placeholder);
  color: var(--vscode-input-placeholderForeground);
  pointer-events: none;
}
:deep(.inline-file-tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  margin: 0 2px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  border-radius: 4px;
  font-size: 11px;
  vertical-align: middle;
  user-select: all;
}
#result-area {
  min-height: 200px;
  width: 100%;
  box-sizing: border-box;
  padding: 6px;
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  font-family: var(--vscode-editor-font-family);
  border: 1px solid var(--vscode-input-border);
  resize: vertical;
  outline: none;
  white-space: pre-wrap;
}
</style>
