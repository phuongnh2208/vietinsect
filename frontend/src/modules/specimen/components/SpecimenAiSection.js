import React from "react";
import { useTranslation } from "react-i18next";
import Icon from "../../../components/ui/Icon";

export default function SpecimenAiSection({ aiResults = null }) {
  const { t } = useTranslation();
  if (!aiResults) return null;

  return (
    <section className="card vi-specimen-ai-section">
      <div className="ai-section-header">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="sparkles" size={18} />
          <div>
            <h3>{t("specimenDetail.aiSectionTitle")}</h3>
            <span className="ai-subtitle">EfficientNet-B4</span>
          </div>
        </div>
        {aiResults.confidenceScore && (
          <span className="status-badge" style={{ background: "#EEF6EE", color: "#15803D", borderColor: "#15803D" }}>
            {t("ai.confidence")}: {(aiResults.confidenceScore * 100).toFixed(1)}%
          </span>
        )}
      </div>

      <div className="ai-results-body">
        {aiResults.topPredictions?.length > 0 && (
          <div className="ai-top-predictions">
            <h4>{t("specimenDetail.aiTop5")}</h4>
            <div className="ai-predictions-list">
              {aiResults.topPredictions.map((pred, i) => (
                <div key={i} className="ai-prediction-row">
                  <span className="pred-rank">#{i + 1}</span>
                  <span className="pred-species"><em>{pred.speciesName}</em></span>
                  <div className="pred-bar-wrap">
                    <div className="pred-bar-fill" style={{ width: `${pred.score * 100}%` }} />
                  </div>
                  <span className="pred-score">{(pred.score * 100).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
