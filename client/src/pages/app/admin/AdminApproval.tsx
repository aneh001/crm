import { useState } from "react";
import MobileLayout from "../components/MobileLayout";
import { PageHeader, GlassCard, LoadingSpinner, EmptyState } from "../components/GlassCard";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck, Check, X } from "lucide-react";

export default function AdminApproval() {
  const [filter, setFilter] = useState<"pending" | "approved" | "paid" | "all">("pending");

  // 获取所有老师费用列表（管理员/财务视角）
  const paymentsQuery = trpc.teacherPayments.getAllPayments.useQuery({}, { retry: false });
  const payments = paymentsQuery.data || [];

  const filtered = filter === "all" ? payments : payments.filter((p: any) => p.status === filter);

  const statusLabels: Record<string, string> = {
    pending: "待审批", approved: "已审批", paid: "已结算",
  };
  const statusColors: Record<string, string> = {
    pending: "text-yellow-400 bg-yellow-400/10",
    approved: "text-blue-400 bg-blue-400/10",
    paid: "text-green-400 bg-green-400/10",
  };

  return (
    <MobileLayout>
      <PageHeader title="费用审批" />

      <div className="px-4 pb-6">
        {/* 筛选 */}
        <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
          {(["pending", "approved", "paid", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-all ${
                filter === s
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "bg-white/5 text-slate-400 border border-white/5"
              }`}
            >
              {s === "all" ? "全部" : statusLabels[s]}
              {s !== "all" && ` (${payments.filter((p: any) => p.status === s).length})`}
            </button>
          ))}
        </div>

        {paymentsQuery.isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState
            message={filter === "pending" ? "暂无待审批项目" : "暂无记录"}
            icon={<ClipboardCheck className="w-12 h-12 mb-3 opacity-20 text-slate-500" />}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((payment: any) => (
              <ApprovalCard key={payment.id} payment={payment} statusLabels={statusLabels} statusColors={statusColors} />
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}

function ApprovalCard({
  payment, statusLabels, statusColors,
}: {
  payment: any;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const approveMutation = trpc.teacherPayments.approve.useMutation({
    onSuccess: () => {
      utils.teacherPayments.getAllPayments.invalidate();
    },
  });

  const handleApprove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确认审批通过？")) {
      approveMutation.mutate({ id: payment.id, approved: true });
    }
  };

  return (
    <GlassCard className="overflow-hidden" onClick={() => setExpanded(!expanded)}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-white font-medium text-sm">
              {payment.teacherName || "老师"} - {payment.courseName || "课时费"}
            </p>
            <p className="text-slate-500 text-xs mt-0.5">
              {payment.customerName || "—"} · {payment.date || payment.createdAt?.split("T")[0] || "—"}
            </p>
          </div>
          <div className="text-right">
            <span className="text-amber-400 font-semibold">
              ¥{Number(payment.amount || 0).toFixed(0)}
            </span>
            <div className="mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[payment.status] || statusColors.pending}`}>
                {statusLabels[payment.status] || payment.status}
              </span>
            </div>
          </div>
        </div>

        {payment.status === "pending" && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleApprove}
              disabled={approveMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-green-500/10 text-green-400 rounded-xl text-sm active:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              审批通过
            </button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-3 space-y-2 text-xs">
          {payment.orderInfo && (
            <div><span className="text-slate-500">订单信息:</span> <span className="text-slate-300">{payment.orderInfo}</span></div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-500">记录编号</span>
            <span className="text-slate-300">#{payment.id}</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
