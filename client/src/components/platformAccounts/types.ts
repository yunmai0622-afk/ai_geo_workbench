import type { BindingPublishPlatform } from "@shared/platformAccountVerify";

export type AccountRow = {
  id: number;
  accountName: string;
  accountIdOrUrl: string;
  accountGroup: string | null;
  accountRole: string | null;
  isEnabled: boolean;
  verificationStatus: string;
  lastVerifiedAt: Date | string | null;
  lastDetectedAccountName: string | null;
  localAgentId: string | null;
  localProfileId: string | null;
  sessionStatus: string | null;
  lastSessionCheckedAt: Date | string | null;
  lastLoginAt: Date | string | null;
  notes: string;
};

export type AccountWithPlatform = AccountRow & { platform: BindingPublishPlatform };

export type PlatformGroup = {
  platform: BindingPublishPlatform;
  accounts: AccountRow[];
};
