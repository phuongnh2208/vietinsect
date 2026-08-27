import { create } from "zustand";
import taxonomyService from "./taxonomy.service";

const useTaxonomyStore = create((set, get) => ({
  tree: [],
  treeStatus: "idle", // idle | loading | success | error
  treeError: null,

  selectedNodeId: null,
  expandedIds: {},

  selectNode: (id) => set({ selectedNodeId: id }),

  toggleExpanded: (id) =>
    set((state) => ({ expandedIds: { ...state.expandedIds, [id]: !state.expandedIds[id] } })),

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
