<template>
  <div class="rich-editor-container">
    <ul
      v-if="showDropdown"
      class="dropdown-list"
      :class="{ active: showDropdown }"
    >
      <li
        v-for="(item, index) in results"
        :key="index"
        :class="['dropdown-item', { highlight: index === activeIndex }]"
        @mousedown.prevent="selectItem(item)"
      >
        <span class="item-icon">
          <span
            class="iconify"
            :data-icon="
              searchType === 'file' ? 'carbon:document' : 'carbon:data-table'
            "
          ></span>
        </span>
        <div class="item-info">
          <span class="item-name">{{ item.name }}</span>
          <span
            class="item-path"
            v-if="item.path"
            >{{ item.path }}</span
          >
        </div>
      </li>
    </ul>

    <div
      ref="editorRef"
      class="editor-input"
      contenteditable="true"
      :data-placeholder="placeholder"
      @input="handleInput"
      @keydown="handleKeyDown"
    ></div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from "vue";
import { vscodeApi } from "../utils/vscode.js";

const props = defineProps(["placeholder"]);
const emit = defineEmits(["update:files", "update:tables", "change"]);

const editorRef = ref(null);
const showDropdown = ref(false);
const searchType = ref("file"); // 'file' | 'table'
const results = ref([]);
const activeIndex = ref(0);

// 状态记录
const selectedFiles = new Set();
const selectedTables = new Set();

/**
 * 输入检测逻辑
 */
const handleInput = () => {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const textBefore =
    range.startContainer.textContent?.slice(0, range.startOffset) || "";

  // 检测 @ (文件)
  const fileMatch = textBefore.match(/@([^\s]*)$/);
  if (fileMatch) {
    triggerSearch("file", fileMatch[1]);
    return;
  }

  // 检测 # (数据库表)
  const tableMatch = textBefore.match(/#([^\s]*)$/);
  if (tableMatch) {
    triggerSearch("table", tableMatch[1]);
    return;
  }

  showDropdown.value = false;
  emit("change", editorRef.value.innerText);
};

const triggerSearch = (type, keyword) => {
  searchType.value = type;
  const msgType = type === "file" ? "searchFiles" : "searchTables";
  vscodeApi.postMessage({ type: msgType, keyword });
};

/**
 * 键盘导航
 */
const handleKeyDown = (e) => {
  if (!showDropdown.value) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % results.value.length;
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value =
      (activeIndex.value - 1 + results.value.length) % results.value.length;
    return;
  }
  if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    selectItem(results.value[activeIndex.value]);
    return;
  }
};

/**
 * 插入标签 (Tag)
 */
const selectItem = (item) => {
  if (!item) return;

  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;

  // 找到符号位置 (@ 或 #)
  const content = textNode.textContent;
  const symbol = searchType.value === "file" ? "@" : "#";
  const symbolIndex = content.lastIndexOf(symbol, range.startOffset - 1);
  if (symbolIndex === -1) return;

  // 删除符号和已输入字符
  range.setStart(textNode, symbolIndex);
  range.setEnd(textNode, range.startOffset);
  range.deleteContents();

  // 创建标签元素
  const tag = document.createElement("span");
  tag.className = `inline-tag ${searchType.value}-tag`;
  tag.contentEditable = "false";
  const icon =
    searchType.value === "file" ? "carbon:document" : "carbon:data-table";
  tag.innerHTML = `<span class="iconify" data-icon="${icon}"></span> ${item.name}`;

  range.insertNode(tag);

  // 更新状态
  updateSelectedSets(item);

  // 插入空格并移动光标
  const space = document.createTextNode("\u00A0");
  tag.parentNode.insertBefore(space, tag.nextSibling);
  range.setStartAfter(space);
  selection.removeAllRanges();
  selection.addRange(range);

  showDropdown.value = false;
  nextTick(() => window.Iconify?.scan());
};

const updateSelectedSets = (item) => {
  if (searchType.value === "file") {
    selectedFiles.add(item.fsPath);
    emit("update:files", Array.from(selectedFiles));
    return;
  }
  selectedTables.add(item.name);
  emit("update:tables", Array.from(selectedTables));
};

onMounted(() => {
  vscodeApi.onMessage((msg) => {
    if (msg.type === "searchResults" && searchType.value === "file") {
      results.value = msg.files.map((f) => ({
        name: f.fileName,
        path: f.relativePath,
        fsPath: f.fsPath,
      }));
      showDropdown.value = true;
      return;
    }
    if (msg.type === "tableResults" && searchType.value === "table") {
      results.value = msg.tables.map((t) => ({ name: t }));
      showDropdown.value = true;
      return;
    }
  });
});
</script>

<style scoped>
.rich-editor-container {
  position: relative;
  width: 100%;
}
.editor-input {
  min-height: 100px;
  padding: 8px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  outline: none;
  font-size: 13px;
  line-height: 1.6;
}
.editor-input:empty:before {
  content: attr(data-placeholder);
  color: var(--vscode-input-placeholderForeground);
  opacity: 0.6;
}
.dropdown-list {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  background: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 5px;
  padding: 0;
  list-style: none;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  cursor: pointer;
}
.dropdown-item.highlight {
  background: var(--vscode-list-hoverBackground);
}
.item-info {
  display: flex;
  flex-direction: column;
}
.item-name {
  font-weight: bold;
  font-size: 12px;
}
.item-path {
  font-size: 10px;
  opacity: 0.6;
}

:deep(.inline-tag) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  margin: 0 2px;
  border-radius: 3px;
  font-size: 12px;
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  vertical-align: middle;
}
:deep(.table-tag) {
  background: #3e4b3e;
  color: #a7f3d0;
}
</style>
