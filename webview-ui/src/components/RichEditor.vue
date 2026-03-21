<template>
  <div class="rich-editor-container">
    <editor-content
      :editor="editor"
      class="editor-input"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { Editor, EditorContent, VueRenderer } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import tippy from "tippy.js";
import MentionList from "./MentionList.vue";
import { vscodeApi } from "../utils/vscode.js";

const props = defineProps(["placeholder"]);
const emit = defineEmits(["update:files", "update:tables", "change"]);

const editor = ref(null);

// --- 异步搜索桥接器 ---
const searchBackend = (type, keyword) => {
  return new Promise((resolve) => {
    const msgType = type === "file" ? "searchResults" : "tableResults";

    const listener = (event) => {
      const msg = event.data;
      if (msg.type === msgType) {
        window.removeEventListener("message", listener);
        if (type === "file") {
          resolve(
            msg.files.map((f) => ({
              id: f.fsPath,
              label: f.fileName,
              path: f.relativePath,
            })),
          );
        } else {
          resolve(msg.tables.map((t) => ({ id: t, label: t })));
        }
      }
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
  const FileMention = Mention.extend({
    name: "fileMention",
  }).configure({
    HTMLAttributes: { class: "inline-tag file-tag" },
    suggestion: suggestionConfig("@", "file"),
  });

  const TableMention = Mention.extend({
    name: "tableMention",
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
      }),
      Placeholder.configure({ placeholder: props.placeholder }),
      FileMention,
      TableMention,
    ],
    // 【核心修改点】：处理粘贴识别标记
    editorProps: {
      handlePaste(view, event) {
        const { clipboardData } = event;
        const html = clipboardData?.getData("text/html");
        const text = clipboardData?.getData("text/plain");

        if (!text) return false;

        // Tiptap 生成的节点自带 data-type 标记，这是我们的身份 ID
        const isInternalCopy =
          html &&
          (html.includes('data-type="fileMention"') ||
           html.includes('data-type="tableMention"'));

        if (isInternalCopy) {
          // 1. 识别到标记：让 Tiptap 走原生解析，完美还原蓝色的 Tag，并且撤销栈正常
          return false;
        } else {
          // 2. 无标记：外部复制的纯文本或代码，当做字符串强行插入，保留 <el-button>
          const { state, dispatch } = view;
          dispatch(state.tr.insertText(text));

          setTimeout(() => {
            if (editor.value) emit("change", editor.value.getText());
          }, 10);

          return true; // 返回 true 拦截浏览器的默认富文本粘贴
        }
      },
    },
    content: "",
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
}

:deep(.table-tag) {
  background: #3e4b3e;
  color: #a7f3d0;
}
</style>