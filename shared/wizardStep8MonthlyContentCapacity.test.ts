import { describe, expect, it } from "vitest";
import {
  monthlyContentCapacityValueFromOptionId,
  resolveMonthlyContentCapacityOptionId,
} from "./wizardStep8MonthlyContentCapacity";

describe("wizardStep8MonthlyContentCapacity", () => {
  it("选项映射为存库代表值", () => {
    expect(monthlyContentCapacityValueFromOptionId("light")).toBe(2);
    expect(monthlyContentCapacityValueFromOptionId("standard")).toBe(6);
    expect(monthlyContentCapacityValueFromOptionId("high")).toBe(9);
    expect(monthlyContentCapacityValueFromOptionId("unsure")).toBe(0);
  });

  it("从存库值还原选项", () => {
    expect(resolveMonthlyContentCapacityOptionId(2)).toBe("light");
    expect(resolveMonthlyContentCapacityOptionId(6)).toBe("standard");
    expect(resolveMonthlyContentCapacityOptionId(9)).toBe("high");
    expect(resolveMonthlyContentCapacityOptionId(0)).toBe("unsure");
  });

  it("兼容历史自由填写数值", () => {
    expect(resolveMonthlyContentCapacityOptionId(1)).toBe("light");
    expect(resolveMonthlyContentCapacityOptionId(5)).toBe("standard");
    expect(resolveMonthlyContentCapacityOptionId(12)).toBe("high");
  });
});
