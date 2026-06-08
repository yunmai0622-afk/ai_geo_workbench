# AiDiagnosisFlowPage Structure Notes

## Location
- File: client/src/pages/V12FlowPages.tsx
- Function: AiDiagnosisFlowPage (exported, line ~895)
- Ends at line ~2288

## Key Data Available
- scoreQuery.data: totalScore, visibilityLevel, aiVisibilityScore, aiRecommendationScore
- analyses: list of diagnosis results
- tasks: optimization tasks
- targetQuestions: questions with enabled flag
- t0ResultsDisplay: T0 baseline results (mentionRate, recommendRate, byPlatform, byQuestionType, competitorAppearances, competitorNames)
- diagnosisVisualization: visualization data
- platformCards: 5 AI platform cards (doubao, kimi, deepseek, qwen, wenxin)
- gapCount, gapCardsPreview, gapCardsAll
- headline, awarenessLevel, nextStepSuggestion, primaryIssueLine
- mentionPctDisplay, recommendPctDisplay
- lastDiagnosisLabel

## Current Render Blocks (in order)
1. Page title "AI 实测诊断"
2. Core diagnosis summary card (GEO score, gap count, recommend directions, awareness level, primary issue)
3. "下一步内容资产动作" action cards + "去生成内容资产" button
4. FirstUseHintBanner
5. T0 manual gate (running/completed/not started states)
6. Diagnosis status badge + last test time
7. Load hint (error state)
8. Core metrics grid (mention rate, recommend rate, coverage score, question count)
9. T0 Visualization panel
10. Platform cards (5 AI platforms)
11. Empty state
12. Operation status messages
13. AI diagnosis progress card
14. Profile incomplete warning
15. Diagnosis flow console (step indicator + target questions + run diagnosis button)
16. T0 baseline details (collapsible)
17. Content gaps + target questions grid
18. Full diagnosis details (collapsible)

## Restructure Plan
Per user requirements:
- First screen: GEO score conclusion, competitor suppression, core gaps, next step
- Max 3-4 core blocks
- No engineering fields
- Light SaaS style (already mostly there)
- Primary button: "保存并开始 AI 诊断" or "查看诊断证据"
- Collapse secondary info
- Remove dark glass effects (none present)

## Key Helper Functions Used
- buildDiagnosisHeadlineLine, diagnosisAwarenessLevel, buildDiagnosisNextStepSuggestion
- topDiagnosisGapCards, topTargetQuestionCards
- diagnosisMentionRateHint, diagnosisRecommendRateHint
- formatAiDiagnosisDateTime, formatT0Rate
- scoreReason, scoreFactors
- executeDiagnosisPipeline, requestRunContentDiagnosis, requestStartT0Baseline
- handleGenerateTargetQuestions, handleStartT0Baseline, handleResetT0Baseline
- handleExportT0ResultsCsv, refreshT0Status

## Imports needed (from existing)
- Brain, ChevronDown from lucide-react
- Button, Spinner, toast
- All trpc hooks already in place
- T0DiagnosisVisualizationPanel, AiTaskProgressCard, FirstUseHintBanner
- AiDiagnosisT0ConfirmDialog, AiDiagnosisRerunConfirmDialog, DangerousActionConfirmDialog
- SubscriptionUpgradePrompt
