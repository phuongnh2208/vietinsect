import React, { useEffect, useMemo, useState } from "react";
import Icon from "../../../components/ui/Icon";
import ConfirmDialog from "../../../components/ui/ConfirmDialog";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/ToastProvider";
import useTaxonomyStore from "../taxonomy.store";
import taxonomyService from "../taxonomy.service";
import { flattenTree } from "../taxonomy.utils";
import TaxonForm from "../components/TaxonForm";
import SynonymManager from "../components/SynonymManager";
import ImportChecklistPanel from "../components/ImportChecklistPanel";

const SECTIONS = [
  { id: "form", label: "Thêm / sửa taxon", icon: "edit" },
  { id: "synonym", label: "Đồng danh pháp", icon: "layers" },
  { id: "import", label: "Import danh lục", icon: "upload" },
];

export default function TaxonEditorPage() {
  const { toast } = useToast();
  const tree = useTaxonomyStore((state) => state.tree);
  const treeStatus = useTaxonomyStore((state) => state.treeStatus);
  const treeError = useTaxonomyStore((state) => state.treeError);
  const fetchTree = useTaxonomyStore((state) => state.fetchTree);
  const [section, setSection] = useState("form");
  const [editingTaxon, setEditingTaxon] = useState(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const flatTaxa = useMemo(() => flattenTree(tree), [tree]);
  const filteredTaxa = useMemo(
    () => (query.trim().length < 2 ? flatTaxa : flatTaxa.filter((taxon) => taxon.scientificName.toLowerCase().includes(query.trim().toLowerCase()))),
    [flatTaxa, query],
  );

  const handleCreateOrUpdate = async (payload) => {
    setSubmitting(true);
    try {
      if (editingTaxon) {
        await taxonomyService.updateTaxon(editingTaxon.id, payload);
        toast(`Đã cập nhật ${payload.scientificName}`, "success");
      } else {
        const result = await taxonomyService.createTaxon(payload);
        if (result.colSuggestions?.length > 0 && !result.colSuggestions.some((c) => c.scientificName?.toLowerCase() === payload.scientificName.toLowerCase())) {
          toast(`Đã thêm ${payload.scientificName} · Catalogue of Life chưa tìm thấy tên khớp chính xác, vui lòng kiểm tra lại chính tả`, "warning");
        } else {
          toast(`Đã thêm ${payload.scientificName}`, "success");
        }
      }
      setEditingTaxon(null);
      await fetchTree({ force: true });
    } catch (err) {
      toast(err.response?.data?.message || "Không thể lưu taxon", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await taxonomyService.deleteTaxon(pendingDelete.id);
      toast(`Đã xóa ${pendingDelete.scientificName}`, "success");
      if (editingTaxon?.id === pendingDelete.id) setEditingTaxon(null);
      await fetchTree({ force: true });
    } catch (err) {
      toast(err.response?.data?.message || "Không thể xóa taxon này", "error");
    } finally {
      setPendingDelete(null);
    }
  };

  const handleSetSynonym = async (taxonId, acceptedTaxonId) => {
    try {
      await taxonomyService.setSynonym(taxonId, acceptedTaxonId);
      toast("Đã cập nhật đồng danh pháp", "success");
      await fetchTree({ force: true });
    } catch (err) {
      toast(err.response?.data?.message || "Không thể gắn đồng danh pháp", "error");
    }
  };

  const handleClearSynonym = async (taxonId) => {
    try {
      await taxonomyService.clearSynonym(taxonId);
      toast("Đã gỡ đồng danh pháp", "success");
      await fetchTree({ force: true });
    } catch (err) {
      toast(err.response?.data?.message || "Không thể gỡ đồng danh pháp", "error");
    }
  };

  return (
    <div className="page-container page-content vi-page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow"><Icon name="edit" size={14} />SCR-14 · Phân loại học & Hồ sơ loài</div>
          <h1>Quản lý danh pháp</h1>
          <p className="page-description">Thêm mới hoặc hiệu chỉnh các bậc taxon, quản lý accepted/synonym, xác thực tên qua Catalogue of Life, import danh lục Excel.</p>
        </div>
      </div>

      <div className="screen-placeholder-grid">
        <section className="card panel">
          <div className="panel-title">
            <h2>Danh sách taxon</h2>
            <span>{flatTaxa.length} bản ghi</span>
          </div>
          <div className="form-field" style={{ marginBottom: 14 }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Lọc theo tên khoa học..." />
          </div>

          {treeStatus === "loading" || treeStatus === "idle" ? (
            <LoadingState label="Đang tải danh sách taxon..." />
          ) : treeStatus === "error" ? (
            <EmptyState icon="alert" title="Không tải được danh sách" description={treeError} action={<button className="button button-ghost" onClick={() => fetchTree({ force: true })}>Thử lại</button>} />
          ) : filteredTaxa.length === 0 ? (
            <EmptyState icon="tree" title="Chưa có taxon nào" description="Thêm taxon gốc (Kingdom) ở form bên phải để bắt đầu." />
          ) : (
            <div className="placeholder-list" style={{ maxHeight: 560, overflowY: "auto" }}>
              {filteredTaxa.map((taxon) => (
                <div key={taxon.id} className="placeholder-row">
                  <div>
                    <strong className="taxonomy-name">{"— ".repeat(taxon.depth)}{taxon.scientificName}</strong>
                    <span>{taxon.rank}{taxon.taxonomicStatus === "synonym" ? " · synonym" : ""} · {taxon.specimenCount} mẫu vật</span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="icon-button" onClick={() => { setEditingTaxon(taxon); setSection("form"); }} aria-label="Sửa"><Icon name="edit" size={16} /></button>
                    <button className="icon-button" onClick={() => setPendingDelete(taxon)} aria-label="Xóa"><Icon name="close" size={16} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="card panel">
          <div className="tabs-row">
            {SECTIONS.map((item) => (
              <button key={item.id} className={`tab-button${section === item.id ? " active" : ""}`} onClick={() => setSection(item.id)}>
                <Icon name={item.icon} size={14} /> {item.label}
              </button>
            ))}
          </div>

          {section === "form" ? (
            <TaxonForm
              editingTaxon={editingTaxon}
              parentOptions={flatTaxa}
              onSubmit={handleCreateOrUpdate}
              onCancelEdit={() => setEditingTaxon(null)}
              submitting={submitting}
            />
          ) : null}

          {section === "synonym" ? (
            <SynonymManager taxonOptions={flatTaxa} onSetSynonym={handleSetSynonym} onClearSynonym={handleClearSynonym} />
          ) : null}

          {section === "import" ? (
            <ImportChecklistPanel onImported={() => fetchTree({ force: true })} />
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Xóa taxon "${pendingDelete?.scientificName}"?`}
        message="Chỉ xóa được taxon không còn taxon con hoặc mẫu vật liên kết. Thao tác này không thể hoàn tác."
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
