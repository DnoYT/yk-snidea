<template>
  <div
    class="dropdown-list"
    ref="containerRef"
  >
    <template v-if="items.length">
      <div
        v-for="(item, index) in items"
        :key="index"
        :class="['dropdown-item', { highlight: index === selectedIndex }]"
        @click="selectItem(index)"
        @mouseenter="selectedIndex = index"
      >
        <span class="item-icon">
          <span
            class="iconify"
            :data-icon="
              type === 'file' ? 'carbon:document' : 'carbon:data-table'
            "
          ></span>
        </span>
        <div class="item-info">
          <span class="item-name">{{ item.label }}</span>
          <span
            class="item-path"
            v-if="item.path"
            >{{ item.path }}</span
          >
        </div>
      </div>
    </template>
    <div
      v-else
      class="dropdown-item empty"
    >
      没有找到结果...
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from "vue";

const props = defineProps({
  items: { type: Array, required: true },
  command: { type: Function, required: true },
  type: { type: String, default: "file" },
});

const selectedIndex = ref(0);
const containerRef = ref(null);

// 监听选中索引，实现自动滚动（不遮挡）
watch(selectedIndex, () => {
  nextTick(() => {
    if (!containerRef.value) return;
    const activeItem = containerRef.value.querySelector(".highlight");
    if (activeItem) {
      activeItem.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  });
});

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0;
  },
);

const onKeyDown = ({ event }) => {
  if (event.key === "ArrowUp") {
    upHandler();
    return true;
  }
  if (event.key === "ArrowDown") {
    downHandler();
    return true;
  }
  if (event.key === "Enter" || event.key === "Tab") {
    enterHandler();
    return true;
  }
  return false;
};

// 【核心修改点】：去掉了 % 取余逻辑，碰到顶部/底部直接卡住，不再循环
const upHandler = () => {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  }
};

const downHandler = () => {
  if (selectedIndex.value < props.items.length - 1) {
    selectedIndex.value++;
  }
};

const enterHandler = () => {
  selectItem(selectedIndex.value);
};

const selectItem = (index) => {
  const item = props.items[index];
  if (item) {
    props.command({ id: item.id, label: item.label });
  }
};

defineExpose({ onKeyDown });
</script>

<style scoped>
.dropdown-list {
  background: var(--vscode-dropdown-background);
  border: 1px solid var(--vscode-dropdown-border);
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-height: 200px;
  overflow-y: auto;
  min-width: 200px;
  padding: 4px 0;
  z-index: 9999;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  color: var(--vscode-dropdown-foreground);
}
.dropdown-item.empty {
  opacity: 0.6;
  justify-content: center;
  cursor: default;
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
}
.item-path {
  font-size: 10px;
  opacity: 0.6;
}
</style>
