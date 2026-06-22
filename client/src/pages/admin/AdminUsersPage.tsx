import {
  AdminLayout,
  AdminPageHeader,
} from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  CUSTOMER_ROLE_LABELS,
  CUSTOMER_ROLES,
  USER_REVIEW_STATUS_LABELS,
  type UserReviewStatus,
} from "@shared/platformAdmin";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const TAB_STATUSES: Array<{ key: UserReviewStatus; label: string }> = [
  { key: "pending_review", label: "待审核" },
  { key: "active", label: "已通过" },
  { key: "rejected", label: "已拒绝" },
  { key: "disabled", label: "已禁用" },
];

export default function AdminUsersPage() {
  const [tab, setTab] = useState<UserReviewStatus>("pending_review");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState<string | undefined>();
  const [approveDraft, setApproveDraft] = useState<
    Record<number, { companyId: string; customerRole: (typeof CUSTOMER_ROLES)[number] }>
  >({});

  const utils = trpc.useUtils();
  const companiesQuery = trpc.admin.customers.list.useQuery({});
  const listQuery = trpc.admin.users.list.useQuery({ status: tab, search: searchQuery });

  const approve = trpc.admin.users.approve.useMutation({
    onSuccess: async () => {
      await utils.admin.users.list.invalidate();
      toast.success("用户已通过审核");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "审核失败")),
  });
  const reject = trpc.admin.users.reject.useMutation({
    onSuccess: async () => {
      await utils.admin.users.list.invalidate();
      toast.success("已拒绝用户");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "操作失败")),
  });
  const disable = trpc.admin.users.disable.useMutation({
    onSuccess: async () => {
      await utils.admin.users.list.invalidate();
      toast.success("已禁用用户");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "操作失败")),
  });

  useEffect(() => {
    document.title = "注册用户审核 - 平台运营后台";
  }, []);

  const companies = companiesQuery.data ?? [];
  const rows = listQuery.data ?? [];

  return (
    <AdminLayout>
      <AdminPageHeader
        title="注册用户审核"
        description="审核新注册账号，分配客户公司和角色后才可使用系统。"
      />

      <Tabs value={tab} onValueChange={v => setTab(v as UserReviewStatus)}>
        <TabsList>
          {TAB_STATUSES.map(item => (
            <TabsTrigger key={item.key} value={item.key}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_STATUSES.map(item => (
          <TabsContent key={item.key} value={item.key} className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-4">
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={e => {
                    e.preventDefault();
                    setSearchQuery(search.trim() || undefined);
                  }}
                >
                  <Input
                    placeholder="搜索姓名或邮箱"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <Button type="submit" variant="secondary">
                    搜索
                  </Button>
                </form>

                {listQuery.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Spinner className="size-6 text-blue-600" />
                  </div>
                ) : rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500">暂无用户</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>用户名称</TableHead>
                          <TableHead>邮箱</TableHead>
                          <TableHead>所属公司</TableHead>
                          <TableHead>注册时间</TableHead>
                          <TableHead>申请说明</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map(row => {
                          const draft = approveDraft[row.id] ?? {
                            companyId: "",
                            customerRole: "customer_admin" as const,
                          };
                          return (
                            <TableRow key={row.id} data-testid={`admin-user-${row.id}`}>
                              <TableCell className="font-medium">
                                {row.name?.trim() || "未填写姓名"}
                              </TableCell>
                              <TableCell>{row.email ?? "—"}</TableCell>
                              <TableCell>{row.companyName ?? "未分配"}</TableCell>
                              <TableCell>
                                {row.createdAt
                                  ? new Date(row.createdAt).toLocaleString()
                                  : "—"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {row.applicationNote ?? "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {USER_REVIEW_STATUS_LABELS[row.userStatus]}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                {tab === "pending_review" ? (
                                  <div className="flex flex-col items-end gap-2">
                                    <div className="flex flex-wrap items-end justify-end gap-2">
                                      <div className="space-y-1">
                                        <Label className="text-xs">分配公司</Label>
                                        <Select
                                          value={draft.companyId}
                                          onValueChange={value =>
                                            setApproveDraft(prev => ({
                                              ...prev,
                                              [row.id]: { ...draft, companyId: value },
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="w-[160px]">
                                            <SelectValue placeholder="选择公司" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {companies.map(c => (
                                              <SelectItem key={c.id} value={String(c.id)}>
                                                {c.companyName}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">角色</Label>
                                        <Select
                                          value={draft.customerRole}
                                          onValueChange={value =>
                                            setApproveDraft(prev => ({
                                              ...prev,
                                              [row.id]: {
                                                ...draft,
                                                customerRole: value as (typeof CUSTOMER_ROLES)[number],
                                              },
                                            }))
                                          }
                                        >
                                          <SelectTrigger className="w-[140px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {CUSTOMER_ROLES.map(role => (
                                              <SelectItem key={role} value={role}>
                                                {CUSTOMER_ROLE_LABELS[role]}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        disabled={approve.isPending || !draft.companyId}
                                        onClick={() =>
                                          approve.mutate({
                                            userId: row.id,
                                            companyId: Number(draft.companyId),
                                            customerRole: draft.customerRole,
                                          })
                                        }
                                      >
                                        通过审核
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        disabled={reject.isPending}
                                        onClick={() => reject.mutate({ userId: row.id })}
                                      >
                                        拒绝
                                      </Button>
                                    </div>
                                  </div>
                                ) : tab === "active" ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={disable.isPending}
                                    onClick={() => disable.mutate({ userId: row.id })}
                                  >
                                    禁用
                                  </Button>
                                ) : null}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </AdminLayout>
  );
}
