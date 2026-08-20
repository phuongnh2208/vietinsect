import { create } from "zustand";

const useTaxonomyStore = create((set) => ({
  selectedNodeId: null,
  expandedIds: {},

  selectNode: (id) => set({ selectedNodeId: id }),

  toggleExpanded: (id) =>
    set((state) => ({ expandedIds: { ...state.expandedIds, [id]: !state.expandedIds[id] } })),
}));

export default useTaxonomyStore;
