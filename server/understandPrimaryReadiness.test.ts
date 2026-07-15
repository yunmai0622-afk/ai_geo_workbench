import { describe, expect, it } from "vitest";
import { BASELINE_V1_DIMENSIONS, calculateCoverage, evaluatePrimaryReadiness, FROZEN_UNDERSTAND_DIMENSIONS } from "./understandPrimaryReadiness";

describe("Understand primary readiness", () => {
  it("rejects methodology drift", () => {
    expect(evaluatePrimaryReadiness({ fixedQuestionSetComplete:true,traceable:true,reviewCount:8,assessmentCount:8,methodologyDimensions:BASELINE_V1_DIMENSIONS,minimumTruthMet:true,unverifiableExplained:true,customerPresentationStable:true,differenceClassified:true,projectIsolationPassed:true,dualWrite:false,rollbackVerified:true }).ready).toBe(false);
    expect(evaluatePrimaryReadiness({ fixedQuestionSetComplete:true,traceable:true,reviewCount:8,assessmentCount:8,methodologyDimensions:FROZEN_UNDERSTAND_DIMENSIONS,minimumTruthMet:true,unverifiableExplained:true,customerPresentationStable:true,differenceClassified:true,projectIsolationPassed:true,dualWrite:false,rollbackVerified:true }).ready).toBe(true);
  });
  it("does not equate question and evidence coverage", () => {
    expect(calculateCoverage({ plannedQuestions:8,executedQuestions:8,successfulExtractions:8,requiredTruthFacts:14,verifiedTruthFacts:11,requiredEvidenceFacts:14,evidencedFacts:8,completedAssessments:8 }))
      .toEqual({ questionExecution:10000,extraction:10000,verifiedTruth:7857,evidence:5714,assessment:10000 });
  });
  it("requires appended reviews and rollback", () => {
    const result = evaluatePrimaryReadiness({ fixedQuestionSetComplete:true,traceable:true,reviewCount:0,assessmentCount:8,methodologyDimensions:FROZEN_UNDERSTAND_DIMENSIONS,minimumTruthMet:true,unverifiableExplained:true,customerPresentationStable:true,differenceClassified:true,projectIsolationPassed:true,dualWrite:false,rollbackVerified:false });
    expect(result.ready).toBe(false); expect(result.gates.manualReviewComplete).toBe(false); expect(result.gates.rollbackVerified).toBe(false);
  });
});
