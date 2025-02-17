/* eslint-disable ts/prefer-literal-enum-member */
export enum PatchFlags {
  // 表示节点有动态的文本内容（如通过 {{ }} 绑定的内容）
  TEXT = 1,
  // 表示元素有动态的 class 绑定
  CLASS = 1 << 1,
  // 表示元素有动态的 style 绑定
  STYLE = 1 << 2,
  // 表示元素有非 class/style 的动态属性
  PROPS = 1 << 3,
  // 表示元素有需要完整 props 比较的动态属性（如绑定对象）
  FULL_PROPS = 1 << 4,
  // 表示需要保留事件监听器的特殊标记（SSR hydration时使用）
  HYDRATE_EVENTS = 1 << 5,
  // 表示子节点顺序不会变化的 Fragment（<>...</>）
  STABLE_FRAGMENT = 1 << 6,
  // 表示带有 key 的 Fragment（子节点可能重新排序）
  KEYED_FRAGMENT = 1 << 7,
  // 表示没有 key 的 Fragment
  UNKEYED_FRAGMENT = 1 << 8,
  // 表示组件需要非 props 的 patch（如指令更新）
  NEED_PATCH = 1 << 9,
  // 表示组件有动态插槽（如 v-if 切换的插槽）
  DYNAMIC_SLOTS = 1 << 10,
  // 开发环境专用标记，表示根组件是 Fragment
  DEV_ROOT_FRAGMENT = 1 << 11,
  // 表示静态提升节点，不需要追踪变化
  HOISTED = -1,
  // 表示退出优化模式，需要完全diff
  BAIL = -2,
}

// patchFlag 映射
export const PatchFlagNames = {
  [PatchFlags.TEXT]: `TEXT`,
  [PatchFlags.CLASS]: `CLASS`,
  [PatchFlags.STYLE]: `STYLE`,
  [PatchFlags.PROPS]: `PROPS`,
  [PatchFlags.FULL_PROPS]: `FULL_PROPS`,
  [PatchFlags.HYDRATE_EVENTS]: `HYDRATE_EVENTS`,
  [PatchFlags.STABLE_FRAGMENT]: `STABLE_FRAGMENT`,
  [PatchFlags.KEYED_FRAGMENT]: `KEYED_FRAGMENT`,
  [PatchFlags.UNKEYED_FRAGMENT]: `UNKEYED_FRAGMENT`,
  [PatchFlags.NEED_PATCH]: `NEED_PATCH`,
  [PatchFlags.DYNAMIC_SLOTS]: `DYNAMIC_SLOTS`,
  [PatchFlags.DEV_ROOT_FRAGMENT]: `DEV_ROOT_FRAGMENT`,
  [PatchFlags.HOISTED]: `HOISTED`,
  [PatchFlags.BAIL]: `BAIL`,
}
