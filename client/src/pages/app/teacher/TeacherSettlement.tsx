import { useState } from "react";
import MobileLayout from "../components/MobileLayout";
import { PageHeader, GlassCard, StatCard, LoadingSpinner, EmptyState } from "../components/GlassCard";
import { trpc } from "@/lib/trpc";
import { DollarSign, Clock, CheckCircle, AlertCircle } from "lucide-react";

export default function TeacherSettlement() {
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const paymentsQuery = trpc.teacherPayments.getMyPayments.useQuery({}, { retry: false });
  const payments = paymentsQuery.data || [];

  const thisMonth = new Date().toISOString().substring(0, 7);

  const monthPayments = payments.filter((p: any) => (p.createdAt || "").startsWith(thisMonth));
  const displayed = period === "month" ? monthPayments : payments;
  const filtered = statusFilter === "all" ? displayed : displayed.filter((p: any) => p.status === statusFilter);

  const totalAmount = displayed.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const paidAmount = displayed
    .filter((p: any) => p.status === "paid")
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const pendingAmount = displayed
    .filter((p: any) => p.status === "pending" || p.status === "approved")
    .reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

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
      <PageHeader title="结算明细" />

      <div className="px-4 pb-6 space-y-5">
        {/* 结算概览 */}
        <div className="bg-gradient-to-br from-green-600/20 via-blue-600/15 to-green-800/10 backdrop-blur-xl border border-green-500/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-5 h-5 text-green-400" />
            <span className="text-green-400/80 text-sm font-medium">
              {period === "month" ? "本月" : "累计"}结算
            </span>
          </div>
          <p className="text-3xl font-bold text-white mb-1">
            ¥{totalAmount.toFixed(2)}
          </p>
          <p className="text-slate-500 text-xs">
            已结算 ¥{paidAmount.toFixed(0)} · 待结算 ¥{pendingAmount.toFixed(0)}
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label="已结算"
            value={`¥${paidAmount.toFixed(0)}`}
            icon={<CheckCircle className="w-3.5 h-3.5" />}
            color="green"
          />
          <StatCard
            label="待结算"
            value={`¥${pendingAmount.toFixed(0)}`}
            icon={<Clock className="w-3.5 h-3.5" />}
            color="amber"
          />
          <StatCard
            label="总课次"
            value={displayed.length}
            icon={<AlertCircle className="w-3.5 h-3.5" />}
            color="blue"
          />
        </div>

        {/* 筛选 */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <button
              onClick={() => setPeriod("month")}
              className={`px-3 py-1 rounded-lg text-xs ${
                period === "month" ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-slate-500"
              }`}
            >
              本月
            </button>
            <button
              onClick={() => setPeriod("all")}
              className={`px-3 py-1 rounded-lg text-xs ${
                period === "all" ? "bg-amber-500/20 text-amber-400" : "bg-white/5 text-slate-500"
              }`}
            >
              全部
            </button>
          </div>
          <div className="flex gap-1">
            {["all", "pending", "approved", "paid"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2 py-1 rounded-lg text-[10px] ${
                  statusFilter === s ? "bg-white/10 text-white" : "bg-white/5 text-slate-500"
                }`}
              >
                {s === "all" ? "全部" : statusLabels[s]}
              </button>
            ))}
          </div>
        </div>

        {/* 结算列表 */}
        {paymentsQuery.isLoading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <EmptyState message="暂无结算记录" />
        ) : (
          <div className="space-y-2">
            {filtered.map((payment: any) => (
              <GlassCard key={payment.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {payment.courseName || payment.orderInfo || "课时费"}
                    </p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {payment.customerName || "—"} · {payment.date || payment.createdAt?.split("T")[0] || "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-green-400 font-semibold">
                      ¥{Number(payment.amount || 0).toFixed(0)}
                    </span>
                    <div className="mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColors[payment.status] || statusColors.pending}`}>
                        {statusLabels[payment.status] || payment.status}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
