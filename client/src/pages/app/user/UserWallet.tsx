import MobileLayout from "../components/MobileLayout";
import { GlassCard, PageHeader, LoadingSpinner, EmptyState } from "../components/GlassCard";
import { trpc } from "@/lib/trpc";
import { Wallet, ArrowUpRight, ArrowDownLeft, Plus } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

export default function UserWallet() {
  const [, setLocation] = useLocation();
  const membershipQuery = trpc.membership.getStatus.useQuery(undefined, { retry: false });
  const ordersQuery = trpc.orders.list.useQuery(undefined, { retry: false });

  const balance = membershipQuery.data?.accountBalance || 0;
  const orders = ordersQuery.data || [];

  // 从订单中提取消费流水
  const transactions = orders
    .filter((o: any) => o.status === "paid" || o.status === "completed")
    .map((o: any) => ({
      id: o.id,
      type: "expense" as const,
      amount: Number(o.paymentAmount || o.courseAmount || 0),
      description: o.deliveryCourse || "课程消费",
      date: o.paymentDate || o.classDate || "",
    }))
    .slice(0, 20);

  return (
    <MobileLayout>
      <PageHeader title="我的钱包" />

      <div className="px-4 pb-6 space-y-5">
        {/* 余额卡片 */}
        <div className="bg-gradient-to-br from-amber-600/30 via-purple-600/20 to-amber-800/10 backdrop-blur-xl border border-amber-500/10 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5 text-amber-400" />
            <span className="text-amber-400/80 text-sm">账户余额</span>
          </div>
          <p className="text-3xl font-bold text-white mb-4">
            ¥{balance.toFixed(2)}
          </p>
          <button
            onClick={() => setLocation("/app/user/recharge")}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-black font-semibold rounded-xl active:scale-[0.98] transition-transform"
          >
            <Plus className="w-4 h-4" />
            充值
          </button>
        </div>

        {/* 消费流水 */}
        <div>
          <h2 className="text-white font-semibold mb-3">消费记录</h2>
          {ordersQuery.isLoading ? (
            <LoadingSpinner />
          ) : transactions.length === 0 ? (
            <EmptyState message="暂无消费记录" />
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <GlassCard key={tx.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      tx.type === "expense" ? "bg-red-500/10" : "bg-green-500/10"
                    }`}>
                      {tx.type === "expense" ? (
                        <ArrowUpRight className="w-4 h-4 text-red-400" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm">{tx.description}</p>
                      <p className="text-slate-500 text-xs">{tx.date}</p>
                    </div>
                  </div>
                  <span className={`font-medium ${tx.type === "expense" ? "text-red-400" : "text-green-400"}`}>
                    {tx.type === "expense" ? "-" : "+"}¥{tx.amount.toFixed(2)}
                  </span>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      </div>
    </MobileLayout>
  );
}
