<template>
  <div class="rich-editor-container">
    <ul
      v-if="showDropdown"
      class="dropdown-list"
      ref="dropdownListRef"
      :class="{ active: showDropdown }"
    >
      <li
        v-for="(item, index) in results"
        :key="index"
        :class="['dropdown-item', { highlight: index === activeIndex }]"
        @mouseenter="activeIndex = index"
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
      @blur="handleBlur"
    ></div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick, watch } from "vue";
import { vscodeApi } from "../utils/vscode.js";

const props = defineProps(["placeholder"]);
const emit = defineEmits(["update:files", "update:tables", "change"]);

const editorRef = ref(null);
const dropdownListRef = ref(null);
const showDropdown = ref(false);
const searchType = ref("file");
const results = ref([]);
const activeIndex = ref(0);

// 状态记录不再直接由 selectItem 维护，而是作为同步后的结果
let selectedFiles = new Set();
let selectedTables = new Set();

/**
 * 核心逻辑：同步 DOM 中的标签到 Vue 状态
 * 遍历所有 .inline-tag，重新填充 Set
 */
const syncTagsFromDOM = () => {
  if (!editorRef.value) return;

  const newFiles = new Set();
  const newTables = new Set();

  // 获取所有标签
  const fileTags = editorRef.value.querySelectorAll('.file-tag');
  const tableTags = editorRef.value.querySelectorAll('.table-tag');

  // 从 data-id 属性中读回 fsPath 或 tableName
  fileTags.forEach(el => {
    if (el.dataset.id) newFiles.add(el.dataset.id);
  });

  tableTags.forEach(el => {
    if (el.dataset.id) newTables.add(el.dataset.id);
  });

  selectedFiles = newFiles;
  selectedTables = newTables;

  // 通知父组件
  emit("update:files", Array.from(selectedFiles));
  emit("update:tables", Array.from(selectedTables));
};

/**
 * 输入检测逻辑
 */
const handleInput = () => {
  // 1. 每次输入（包括删除）都执行一次同步，确保 selectedFiles 永远与 DOM 一致
  syncTagsFromDOM();

  const selection = window.getSelection();
  if (!selection.rangeCount) return;

  const range = selection.getRangeAt(0);
  const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || "";

  const fileMatch = textBefore.match(/@([^\s]*)$/);
  if (fileMatch) {
    triggerSearch("file", fileMatch[1]);
    return;
  }

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

watch(activeIndex, async (newIndex) => {
  if (showDropdown.value && dropdownListRef.value) {
    await nextTick();
    const children = dropdownListRef.value.children;
    if (children && children[newIndex]) {
      children[newIndex].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }
});

const handleKeyDown = (e) => {
  if (!showDropdown.value) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value + 1) % results.value.length;
    return;
  }
  if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value = (activeIndex.value - 1 + results.value.length) % results.value.length;
    return;
  }
  if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    selectItem(results.value[activeIndex.value]);
    return;
  }
  if (e.key === "Escape") {
    e.preventDefault();
    showDropdown.value = false;
    return;
  }
};

const handleBlur = () => {
  setTimeout(() => { showDropdown.value = false; }, 200);
  emit("change", editorRef.value.innerText);
}

/**
 * 插入标签 (Tag)
 */
const selectItem = (item) => {
  if (!item) return;

  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const textNode = range.startContainer;
  const currentOffset = range.startOffset;

  const content = textNode.textContent;
  const symbol = searchType.value === "file" ? "@" : "#";
  const symbolIndex = content.lastIndexOf(symbol, currentOffset - 1);
  
  if (symbolIndex === -1) {
    showDropdown.value = false;
    return;
  }

  range.setStart(textNode, symbolIndex);
  range.setEnd(textNode, currentOffset);
  range.deleteContents();

  const tag = document.createElement("span");
  tag.className = `inline-tag ${searchType.value}-tag`;
  tag.contentEditable = "false";
  
  // 重要：将文件路径或表名存入 dataset，方便以后 syncTagsFromDOM 时读取
  tag.dataset.id = searchType.value === "file" ? item.fsPath : item.name;

  const icon = searchType.value === "file" ? "@" : "#";
  tag.innerHTML = `${icon} ${item.name}`;

  range.insertNode(tag);

  // 插入后手动触发一次同步
  syncTagsFromDOM();

  const space = document.createTextNode("\u00A0");
  tag.parentNode.insertBefore(space, tag.nextSibling);
  
  range.setStartAfter(space);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  showDropdown.value = false;
  emit("change", editorRef.value.innerText);
  nextTick(() => window.Iconify?.scan());
};

onMounted(() => {
  vscodeApi.onMessage((msg) => {
    if (msg.type === "searchResults" && searchType.value === "file") {
      results.value = msg.files.map((f) => ({
        name: f.fileName,
        path: f.relativePath,
        fsPath: f.fsPath,
      }));
      activeIndex.value = 0;
      showDropdown.value = true;
      return;
    }
    if (msg.type === "tableResults" && searchType.value === "table") {
      results.value = msg.tables.map((t) => ({ name: t }));
      activeIndex.value = 0;
      showDropdown.value = true;
      return;
    }
  });
});
</script>

<style scoped>
/* 样式保持不变 */
.rich-editor-container { position: relative; width: 100%; }
.editor-input { min-height: 100px; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); outline: none; font-size: 13px; line-height: 1.6; }
.editor-input:empty:before { content: attr(data-placeholder); color: var(--vscode-input-placeholderForeground); opacity: 0.6; }
.dropdown-list { position: absolute; bottom: 100%; left: 0; right: 0; z-index: 100; background: var(--vscode-dropdown-background); border: 1px solid var(--vscode-dropdown-border); max-height: 200px; overflow-y: auto; margin-bottom: 5px; padding: 0; list-style: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.dropdown-item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; cursor: pointer; }
.dropdown-item.highlight { background: var(--vscode-list-hoverBackground); }
.item-info { display: flex; flex-direction: column; }
.item-name { font-weight: bold; font-size: 12px; }
.item-path { font-size: 10px; opacity: 0.6; }
:deep(.inline-tag) { display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; margin: 0 2px; border-radius: 3px; font-size: 12px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); vertical-align: middle; }
:deep(.table-tag) { background: #3e4b3e; color: #a7f3d0; }
</style>