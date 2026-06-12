import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "..");
const read = (p: string) => readFileSync(resolve(root, p), "utf-8");

describe("GEO-V2.0-P0-C-Trust-Evidence", () => {
  const schema = read("drizzle/schema.ts");
  const migration = read("drizzle/0063_trust_evidence_items.sql");
  const router = read("server/trustEvidenceRouter.ts");
  const routers = read("server/routers.ts");
  const shared = read("shared/trustEvidence.ts");
  const manager = read("client/src/components/enterpriseProfile/TrustEvidenceManager.tsx");
  const drawer = read("client/src/components/enterpriseProfile/TrustEvidenceDrawer.tsx");
  const advanced = read("client/src/components/enterpriseProfile/AdvancedMaterialsSection.tsx");

  it("schema and migration add trust_evidence_items table", () => {
    expect(schema).toContain("trust_evidence_items");
    expect(schema).toContain("trustEvidenceTypeEnum");
    expect(schema).toContain("linkedCustomerCaseId");
    expect(migration).toContain("CREATE TABLE `trust_evidence_items`");
    expect(migration).toContain("enum('case','certificate','media_coverage'");
    expect(migration).toContain("enum('draft','verified','rejected')");
  });

  it("trustEvidence router exposes CRUD, summary and maturity score", () => {
    expect(router).toContain("getTrustEvidence");
    expect(router).toContain("createTrustEvidence");
    expect(router).toContain("updateTrustEvidence");
    expect(router).toContain("deleteTrustEvidence");
    expect(router).toContain("getTrustEvidenceSummary");
    expect(router).toContain("getTrustEvidenceMaturityScore");
    expect(router).toContain("requireProjectAccess");
    expect(router).toContain('verificationStatus === "已确认"');
    expect(routers).toContain("trustEvidence: trustEvidenceRouter");
  });

  it("TrustEvidenceManager has grouped list, drawer and empty state", () => {
    expect(manager).toContain("trust-evidence-manager");
    expect(manager).toContain("trust-evidence-empty");
    expect(manager).toContain("trust-evidence-grouped-list");
    expect(manager).toContain("TrustEvidenceDrawer");
    expect(manager).toContain("还没有信任证据。添加媒体报道、客户评价、资质证书等");
    expect(manager).toContain("开始发现证据");
    expect(manager).toContain("手动添加证据");
    expect(manager).toContain("TrustEvidenceStep6Section");
    expect(drawer).toContain("trust-evidence-drawer");
    expect(drawer).toContain("max-h-[80vh]");
    expect(drawer).toContain("overflow-y-auto");
    expect(drawer).toContain("trust-evidence-form-type");
    expect(drawer).toContain("trust-evidence-form-title");
    expect(shared).toContain("TRUST_EVIDENCE_TYPE_GROUPS");
    expect(shared).toContain("computeTrustEvidenceMaturityScore");
  });

  it("embedded in wizard step 6 and advanced materials fold", () => {
    const panels = read("client/src/components/enterpriseProfile/wizard/WizardStepPanels.tsx");
    expect(panels).toContain("wizard-step-6");
    expect(panels).toContain("TrustEvidenceManager");
    expect(advanced).toContain("TrustEvidenceManager");
    expect(advanced).toContain("advanced-fold-trust-evidence");
  });
});
