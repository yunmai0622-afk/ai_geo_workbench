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
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";

export default function AdminProjectsPage() {
  const [bindCompanyId, setBindCompanyId] = useState<string>("");
  const [bindProjectId, setBindProjectId] = useState("");
  const [createCompanyId, setCreateCompanyId] = useState<string>("");
  const [createOwnerUserId, setCreateOwnerUserId] = useState("");
  const [createProjectName, setCreateProjectName] = useState("");

  const utils = trpc.useUtils();
  const companiesQuery = trpc.admin.customers.list.useQuery({});
  const listQuery = trpc.admin.projects.listBindings.useQuery({});

  const bind = trpc.admin.projects.bind.useMutation({
    onSuccess: async () => {
      await utils.admin.projects.listBindings.invalidate();
      toast.success("项目已绑定");
      setBindProjectId("");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "绑定失败")),
  });
  const unbind = trpc.admin.projects.unbind.useMutation({
    onSuccess: async () => {
      await utils.admin.projects.listBindings.invalidate();
      toast.success("已解绑项目");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "解绑失败")),
  });
  const createForCompany = trpc.admin.projects.createForCompany.useMutation({
    onSuccess: async () => {
      await utils.admin.projects.listBindings.invalidate();
      toast.success("项目已创建并绑定");
      setCreateProjectName("");
      setCreateOwnerUserId("");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "创建失败")),
  });

  useEffect(() => {
    document.title = "客户项目绑定 - 平台运营后台";
  }, []);

  const companies = companiesQuery.data ?? [];
  const rows = listQuery.data ?? [];

  return (
    <AdminLayout>
      <AdminPageHeader
        title="客户项目绑定"
        description="管理客户公司与企业项目的绑定关系，确保数据隔离。"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium text-gray-900">绑定已有项目</p>
            <div className="space-y-2">
              <Label>客户公司</Label>
              <Select value={bindCompanyId} onValueChange={setBindCompanyId}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>项目 ID</Label>
              <Input
                type="number"
                placeholder="输入 projectId"
                value={bindProjectId}
                onChange={e => setBindProjectId(e.target.value)}
              />
            </div>
            <Button
              disabled={bind.isPending || !bindCompanyId || !bindProjectId}
              onClick={() =>
                bind.mutate({
                  companyId: Number(bindCompanyId),
                  projectId: Number(bindProjectId),
                })
              }
            >
              绑定项目
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium text-gray-900">为客户创建新项目</p>
            <div className="space-y-2">
              <Label>客户公司</Label>
              <Select value={createCompanyId} onValueChange={setCreateCompanyId}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label>归属用户 ID</Label>
              <Input
                type="number"
                placeholder="ownerUserId"
                value={createOwnerUserId}
                onChange={e => setCreateOwnerUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>项目名称</Label>
              <Input
                placeholder="企业名称"
                value={createProjectName}
                onChange={e => setCreateProjectName(e.target.value)}
              />
            </div>
            <Button
              disabled={
                createForCompany.isPending ||
                !createCompanyId ||
                !createOwnerUserId ||
                !createProjectName.trim()
              }
              onClick={() =>
                createForCompany.mutate({
                  companyId: Number(createCompanyId),
                  ownerUserId: Number(createOwnerUserId),
                  enterpriseName: createProjectName.trim(),
                })
              }
            >
              创建并绑定
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          {listQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="size-6 text-blue-600" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">暂无绑定记录</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>客户公司</TableHead>
                    <TableHead>项目名称</TableHead>
                    <TableHead>projectId</TableHead>
                    <TableHead>项目状态</TableHead>
                    <TableHead>建档完整度</TableHead>
                    <TableHead>成熟度分</TableHead>
                    <TableHead>最近 AI 实测</TableHead>
                    <TableHead>最近月报</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(row => (
                    <TableRow key={row.id} data-testid={`admin-binding-${row.id}`}>
                      <TableCell className="font-medium">{row.companyName}</TableCell>
                      <TableCell>{row.projectName}</TableCell>
                      <TableCell>{row.projectId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{row.status === "active" ? "活跃" : "停用"}</Badge>
                      </TableCell>
                      <TableCell>{row.delivery?.profileCompletionScore ?? 0}%</TableCell>
                      <TableCell>{row.delivery?.maturityScore ?? "—"}</TableCell>
                      <TableCell>
                        {row.delivery?.lastAiTestAt
                          ? new Date(row.delivery.lastAiTestAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {row.delivery?.lastReportAt
                          ? new Date(row.delivery.lastReportAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button size="sm" variant="secondary" asChild>
                            <Link href={buildProjectUrl("/workspace", row.projectId)}>
                              进入工作台
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={unbind.isPending}
                            onClick={() =>
                              unbind.mutate({
                                companyId: row.companyId,
                                projectId: row.projectId,
                              })
                            }
                          >
                            解绑
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
