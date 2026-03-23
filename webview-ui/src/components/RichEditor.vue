<template>
  <div class="rich-editor-container">
    <editor-content
      :editor="editor"
      class="editor-input"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from "vue";
import { Editor, EditorContent, VueRenderer } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import tippy from "tippy.js";
import MentionList from "./MentionList.vue";
import { vscodeApi } from "../utils/vscode.js";

const props = defineProps(["placeholder", "va"]);
const emit = defineEmits(["update:files", "update:tables", "change"]);

const editor = ref(null);

// 监听父组件传入的初始值 (仅在编辑器为空时填充)
watch(() => props.va, (newVal) => {
  if (!editor.value) return;
  const currentText = editor.value.getText();
  if (!currentText.trim() && newVal) {
    editor.value.commands.setContent(newVal);
  }
});

// --- 异步搜索桥接器 (已消除 else，加入同名文件处理) ---
const searchBackend = (type, keyword) => {
  return new Promise((resolve) => {
    const msgType = type === "file" ? "searchResults" : "tableResults";

    const listener = (event) => {
      const msg = event.data;
      if (msg.type !== msgType) return; // 提前返回

      window.removeEventListener("message", listener);

      if (type === "file") {
        const files = msg.files || [];
        
        // 统计同名文件出现次数
        const nameCountMap = {};
        files.forEach(f => {
          nameCountMap[f.fileName] = (nameCountMap[f.fileName] || 0) + 1;
        });

        resolve(
          files.map((f) => {
            let displayLabel = f.fileName;
            // 如果存在同名文件，截取它的上一级目录拼接
            if (nameCountMap[f.fileName] > 1) {
              const parts = f.relativePath.split(/[\\/]/);
              if (parts.length > 1) {
                displayLabel = `${parts[parts.length - 2]}/${f.fileName}`;
              }
            }
            return {
              id: f.fsPath,
              label: displayLabel,
              path: f.relativePath, // 携带相对路径供 title 使用
            };
          })
        );
        return; // 提前返回
      }

      // 隐式 else：处理数据表
      resolve((msg.tables || []).map((t) => ({ id: t, label: t })));
    };

    window.addEventListener("message", listener);

    vscodeApi.postMessage({
      type: type === "file" ? "searchFiles" : "searchTables",
      keyword,
    });
  });
};

// --- Tiptap 弹出菜单通用配置 ---
const suggestionConfig = (char, type) => ({
  char,
  items: async ({ query }) => {
    return await searchBackend(type, query);
  },
  render: () => {
    let component;
    let popup;

    return {
      onStart: (props) => {
        component = new VueRenderer(MentionList, {
          props: { ...props, type },
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
        });
      },
      onUpdate(props) {
        component.updateProps({ ...props, type });
        if (!props.clientRect) return;
        popup[0].setProps({ getReferenceClientRect: props.clientRect });
      },
      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup[0].hide();
          return true;
        }
        return component.ref?.onKeyDown(props);
      },
      onExit() {
        popup[0].destroy();
        component.destroy();
      },
    };
  },
});

// --- 初始化 Tiptap ---
onMounted(() => {
  // 扩展 Mention 节点，注入 Hover 提示 (title 属性)
  const FileMention = Mention.extend({
    name: "fileMention",
    addAttributes() {
      return {
        ...this.parent?.(),
        path: {
          default: null,
          parseHTML: element => element.getAttribute("title"),
          renderHTML: attributes => {
            if (!attributes.path) return {};
            return { title: `相对路径: ${attributes.path}` }; // 悬浮显示路径
          },
        },
      };
    }
  }).configure({
    HTMLAttributes: { class: "inline-tag file-tag" },
    suggestion: suggestionConfig("@", "file"),
  });

  const TableMention = Mention.extend({
    name: "tableMention",
    addAttributes() {
      return {
        ...this.parent?.(),
        renderHTML: attributes => {
          return { title: `表结构: ${attributes.id}\n(生成提示词时，将自动注入该表的完整 DDL 代码)` };
        },
      };
    }
  }).configure({
    HTMLAttributes: { class: "inline-tag table-tag" },
    suggestion: suggestionConfig("#", "table"),
  });

  editor.value = new Editor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        code: false,
        codeBlock: false,
        strike: false,
        orderedList: false, 
        bulletList: false,  
        listItem: false,    
        heading: false,     
      }),
      Placeholder.configure({
        placeholder: props.placeholder,
      }),
      FileMention,
      TableMention,
    ],
    editorProps: {
      handlePaste(view, event) {
        const { clipboardData } = event;
        const html = clipboardData?.getData("text/html");
        const text = clipboardData?.getData("text/plain");

        if (!text) return false;

        const isInternalCopy =
          html &&
          (html.includes('data-type="fileMention"') ||
           html.includes('data-type="tableMention"'));

        if (isInternalCopy) {
          return false;
        } 
        
        const { state, dispatch } = view;
        dispatch(state.tr.insertText(text));

        setTimeout(() => {
          if (!editor.value) return; 
          emit("change", editor.value.getText());
        }, 10);

        return true; 
      },
    },
    content: props.va || "", // 初始值加载
    onUpdate: ({ editor }) => {
      emit("change", editor.getText());

      const json = editor.getJSON();
      const files = new Set();
      const tables = new Set();

      const extractTags = (node) => {
        if (node.type === "fileMention") files.add(node.attrs.id);
        if (node.type === "tableMention") tables.add(node.attrs.id);
        if (node.content) node.content.forEach(extractTags);
      };
      extractTags(json);

      emit("update:files", Array.from(files));
      emit("update:tables", Array.from(tables));
    },
  });
});

onBeforeUnmount(() => {
  if (editor.value) editor.value.destroy();
});
</script>

<style scoped>
/* 保持你原本的样式不变 */
.rich-editor-container {
  width: 100%;
}

:deep(.tiptap) {
  min-height: 100px;
  padding: 8px;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
  border-radius: 4px;
  outline: none;
  font-size: 13px;
  line-height: 1.6;
}

:deep(.tiptap:focus) {
  border-color: var(--vscode-focusBorder);
}

:deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  color: var(--vscode-input-placeholderForeground);
  pointer-events: none;
  height: 0;
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
  font-weight: 500;
  cursor: help; /* 增加帮助手势提示可 hover */
}

:deep(.table-tag) {
  background: #3e4b3e;
  color: #a7f3d0;
}
</style>