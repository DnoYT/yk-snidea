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

  // 匹配最后一个 @ 或 # 及其后的非空字符
  // 使用正则提取，确保我们抓到的是正在输入的关键词
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

/**
 * 监听 activeIndex 变化，实现列表自动滚动
 */
watch(activeIndex, async (newIndex) => {
  if (showDropdown.value && dropdownListRef.value) {
    await nextTick();
    const children = dropdownListRef.value.children;
    if (children && children[newIndex]) {
      children[newIndex].scrollIntoView({
        block: "nearest", // 尽量保持最小滚动
        behavior: "smooth"
      });
    }
  }
});

/**
 * 键盘导航
 */
const handleKeyDown = (e) => {
  if (!showDropdown.value) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    if (results.value.length > 0) {
      activeIndex.value = (activeIndex.value + 1) % results.value.length;
    }
    return;
  }
  
  if (e.key === "ArrowUp") {
    e.preventDefault();
    if (results.value.length > 0) {
      activeIndex.value =
        (activeIndex.value - 1 + results.value.length) % results.value.length;
    }
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
  // 延迟关闭，防止点击列表项时先触发 blur 导致列表消失无法选中
  setTimeout(() => {
    showDropdown.value = false;
  }, 200);
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

  // 找到最近的触发符号 (@ 或 #) 的位置
  const content = textNode.textContent;
  const symbol = searchType.value === "file" ? "@" : "#";
  const symbolIndex = content.lastIndexOf(symbol, currentOffset - 1);
  
  if (symbolIndex === -1) {
    showDropdown.value = false;
    return; // 找不到触发符号，安全退出
  }

  // 计算从触发符号到当前光标的长度，包括符号本身和后面可能输入的关键字
  // 我们将删除这段内容
  range.setStart(textNode, symbolIndex);
  range.setEnd(textNode, currentOffset);
  range.deleteContents();

  // 创建标签元素
  const tag = document.createElement("span");
  tag.className = `inline-tag ${searchType.value}-tag`;
  tag.contentEditable = "false";
  const icon =
    searchType.value === "file" ? "carbon:document" : "carbon:data-table";
  
  // 插入带有图标的 HTML
  tag.innerHTML = `<span class="iconify" data-icon="${icon}"></span> ${item.name}`;

  // 插入到编辑器中
  range.insertNode(tag);

  // 更新状态
  updateSelectedSets(item);

  // 插入一个不可断空格 (Zero-width space 或者正常的 \u00A0)，将光标移至其后
  const space = document.createTextNode("\u00A0");
  tag.parentNode.insertBefore(space, tag.nextSibling);
  
  // 恢复光标位置
  range.setStartAfter(space);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);

  // 关闭下拉，通知更新
  showDropdown.value = false;
  emit("change", editorRef.value.innerText);
  
  // 确保新插入的 iconify 图标被渲染
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
      activeIndex.value = 0; // 重置选中项
      showDropdown.value = true;
      return;
    }
    if (msg.type === "tableResults" && searchType.value === "table") {
      results.value = msg.tables.map((t) => ({ name: t }));
      activeIndex.value = 0; // 重置选中项
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
  box-shadow: 0 4px 6px rgba(0,0,0,0.1); /* 增加一点阴影更好看 */
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
  background: #3e4b3e; /* 如果你用了深色主题可以保留，如果跟随VSCode主题建议用变量 */
  color: #a7f3d0;
}
</style>