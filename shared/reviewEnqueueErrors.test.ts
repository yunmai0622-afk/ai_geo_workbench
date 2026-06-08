import { describe, expect, it } from "vitest";
import {
  mapReviewEnqueueCustomerMessage,
  REVIEW_ENQUEUE_CUSTOMER_MESSAGES,
} from "./reviewEnqueueErrors";
import { PUBLISH_QUEUE_DUPLICATE_MESSAGE } from "./publishQueueDedup";
import { publishBlockedNoAccountMessage } from "./platformAccountVerify";

describe("mapReviewEnqueueCustomerMessage", () => {
  it("maps duplicate publish queue to customer message", () => {
    expect(mapReviewEnqueueCustomerMessage(PUBLISH_QUEUE_DUPLICATE_MESSAGE)).toBe(
      REVIEW_ENQUEUE_CUSTOMER_MESSAGES.duplicateTask,
    );
  });

  it("maps missing account to customer message", () => {
    expect(mapReviewEnqueueCustomerMessage(publishBlockedNoAccountMessage("zhihu"))).toBe(
      REVIEW_ENQUEUE_CUSTOMER_MESSAGES.noPlatformAccount,
    );
  });

  it("maps cover preflight code to customer message", () => {
    expect(mapReviewEnqueueCustomerMessage("[COVER_READY] 请先在「编辑内容」中生成并保存封面图")).toBe(
      REVIEW_ENQUEUE_CUSTOMER_MESSAGES.coverMissing,
    );
  });

  it("maps quality preflight code to customer message", () => {
    expect(mapReviewEnqueueCustomerMessage("[QUALITY_PASSED] 当前内容未通过发布前质检")).toBe(
      REVIEW_ENQUEUE_CUSTOMER_MESSAGES.qualityNotPassed,
    );
  });

  it("maps session expired to account sync message", () => {
    expect(
      mapReviewEnqueueCustomerMessage("该知乎账号登录态已失效，请先在本地客户端重新登录。"),
    ).toBe(REVIEW_ENQUEUE_CUSTOMER_MESSAGES.accountNotSynced);
  });
});
