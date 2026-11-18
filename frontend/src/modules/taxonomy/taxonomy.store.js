import { create } from "zustand";
import taxonomyService from "./taxonomy.service";

function findNodeInTree(nodes, targetId) {
  for (const node of nodes) {
    if (node.id === targetId) return node;
    if (node.children?.length) {
      const found = findNodeInTree(node.children, targetId);
      if (found) return found;
    }
  }
  return null;
}

function replaceNodeChildren(nodes, targetId, children) {
  return nodes.map((node) => {
    if (node.id === targetId) {
      return { ...node, children, childCount: children.length };
    }
    if (node.children?.length) {
      return { ...node, children: replaceNodeChildren(node.children, targetId, children) };
    }
    return node;
  });
}

const useTaxonomyStore = create((set, get) => ({
  tree: [],
  treeStatus: "idle", // idle | loading | success | error
  treeError: null,

  selectedNodeId: null,
  expandedIds: {},
  loadingNodeIds: {},

  selectNode: (id) => set({ selectedNodeId: id }),

  toggleExpanded: async (id, currentExpanded) => {
    const nextExpanded = !currentExpanded;
    set((state) => ({ expandedIds: { ...state.expandedIds, [id]: nextExpanded } }));

    if (!nextExpanded) return;

    const node = findNodeInTree(get().tree, id);
    if (node && node.childCount > 0 && (!node.children || node.children.length === 0) && !get().loadingNodeIds[id]) {
      set((state) => ({ loadingNodeIds: { ...state.loadingNodeIds, [id]: true } }));
      try {
        const children = await taxonomyService.getChildren(id);
        set((state) => ({
          tree: replaceNodeChildren(state.tree, id, children),
          loadingNodeIds: { ...state.loadingNodeIds, [id]: false },
        }));
      } catch {
        set((state) => ({ loadingNodeIds: { ...state.loadingNodeIds, [id]: false } }));
      }
    }
  },

  fetchTree: async ({ force = false } = {}) => {
    if (!force && get().treeStatus === "loading") return;
    set({ treeStatus: "loading", treeError: null });
    try {
      const tree = await taxonomyService.getTree();
      set({ tree, treeStatus: "success" });
    } catch (err) {
      set({ treeStatus: "error", treeError: err.response?.data?.message || err.message });
    }
  },
}));

export default useTaxonomyStore;
