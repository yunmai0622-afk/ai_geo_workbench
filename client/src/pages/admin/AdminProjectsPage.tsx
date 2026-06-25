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
import { useAuth } from "@/_core/hooks/useAuth";
import { buildProjectUrl } from "@/lib/activeProject";
import { trpc } from "@/lib/trpc";
import { toUserFacingErrorFromUnknown } from "@shared/userFacingErrors";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { toast } from "sonner";

export default function AdminProjectsPage() {
  const { user } = useAuth();
  const isPlatformAdmin = user?.role === "admin";
  const searchString = useSearch();
  const initialCompanyId = useMemo(() => {
    const params = new URLSearchParams(searchString);
    return params.get("companyId") ?? "";
  }, [searchString]);

  const [bindCompanyId, setBindCompanyId] = useState<string>("");
  const [bindProjectId, setBindProjectId] = useState("");
  const [createCompanyId, setCreateCompanyId] = useState<string>(initialCompanyId);
  const [createOwnerUserId, setCreateOwnerUserId] = useState("");
  const [createProjectName, setCreateProjectName] = useState("");
  const [createIndustry, setCreateIndustry] = useState("");
  const [createWebsite, setCreateWebsite] = useState("");

  const utils = trpc.useUtils();
  const companiesQuery = trpc.admin.customers.list.useQuery({});
  const listQuery = trpc.admin.projects.listBindings.useQuery(
    createCompanyId ? { companyId: Number(createCompanyId) } : {},
  );

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
    onSuccess: async result => {
      await utils.admin.projects.listBindings.invalidate();
      toast.success(`项目已创建，projectId=${result.projectId}`);
      setCreateProjectName("");
      setCreateIndustry("");
      setCreateWebsite("");
      if (isPlatformAdmin) setCreateOwnerUserId("");
    },
    onError: err => toast.error(toUserFacingErrorFromUnknown(err, "创建失败")),
  });

  useEffect(() => {
    document.title = "客户项目绑定 - 代运营管理台";
  }, []);

  useEffect(() => {
    if (initialCompanyId) setCreateCompanyId(initialCompanyId);
  }, [initialCompanyId]);

  const companies = companiesQuery.data ?? [];
  const rows = listQuery.data ?? [];

  const handleCreateProject = () => {
    if (!createCompanyId || !createProjectName.trim()) return;
    createForCompany.mutate({
      companyId: Number(createCompanyId),
      enterpriseName: createProjectName.trim(),
      industry: createIndustry.trim() || undefined,
      website: createWebsite.trim() || undefined,
      ...(isPlatformAdmin && createOwnerUserId
        ? { ownerUserId: Number(createOwnerUserId) }
        : {}),
    });
  };

  return (
    <AdminLayout>
      <AdminPageHeader
        title="客户项目绑定"
        description="为客户公司创建或绑定 GEO 项目，创建后可在工作台继续交付。"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {isPlatformAdmin ? (
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
        ) : null}

        <Card className={isPlatformAdmin ? undefined : "lg:col-span-2"}>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-medium text-gray-900">为客户创建新项目</p>
            <div className="space-y-2">
              <Label>客户公司 *</Label>
              <Select value={createCompanyId} onValueChange={setCreateCompanyId}>
                <SelectTrigger data-testid="create-project-company">
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
              <Label>项目名称 / 企业名称 *</Label>
              <Input
                placeholder="如：某某科技"
                value={createProjectName}
                onChange={e => setCreateProjectName(e.target.value)}
                data-testid="create-project-name"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>行业</Label>
                <Input
                  placeholder="选填"
                  value={createIndustry}
                  onChange={e => setCreateIndustry(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>官网</Label>
                <Input
                  placeholder="https://"
                  value={createWebsite}
                  onChange={e => setCreateWebsite(e.target.value)}
                />
              </div>
            </div>
            {isPlatformAdmin ? (
              <div className="space-y-2">
                <Label>归属用户 ID</Label>
                <Input
                  type="number"
                  placeholder="ownerUserId"
                  value={createOwnerUserId}
                  onChange={e => setCreateOwnerUserId(e.target.value)}
                />
              </div>
            ) : (
              <p className="text-xs text-gray-500">项目将自动归属到您的账号，与其他代运营公司隔离。</p>
            )}
            <Button
              disabled={
                createForCompany.isPending ||
                !createCompanyId ||
                !createProjectName.trim() ||
                (isPlatformAdmin && !createOwnerUserId)
              }
              onClick={handleCreateProject}
              data-testid="create-project-submit"
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
            <p className="py-8 text-center text-sm text-gray-500">暂无绑定记录，请先创建客户与项目</p>
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
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button size="sm" variant="secondary" asChild>
                            <Link href={buildProjectUrl("/workspace", row.projectId)}>
                              进入工作台
                            </Link>
                          </Button>
                          {isPlatformAdmin ? (
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
                          ) : null}
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
