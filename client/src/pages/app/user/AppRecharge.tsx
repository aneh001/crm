import { useState, useEffect } from "react";
import MobileLayout from "../components/MobileLayout";
import { PageHeader, GlassCard, LoadingSpinner } from "../components/GlassCard";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Wallet, CreditCard, Check } from "lucide-react";

type PaymentChannel = "wechat" | "alipay";
type Step = "select" | "paying" | "success";

const PRESET_AMOUNTS = [50, 100, 200, 500, 1000];

export default function AppRecharge() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("select");
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState("");
  const [channel, setChannel] = useState<PaymentChannel>("wechat");
  const [orderId, setOrderId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // 查询会员状态（含账户余额）
  const { data: statusData, refetch: refetchStatus } =
    trpc.membership.getStatus.useQuery(undefined, { enabled: !!user });

  // 查询充值订单状态（支付中轮询）
  const { data: rechargeStatus } = trpc.membership.getRechargeOrderStatus.useQuery(
    { orderId: orderId! },
    { enabled: step === "paying" && !!orderId, refetchInterval: 3000 }
  );

  // 创建充值订单
  const createRechargeOrder = trpc.membership.createRechargeOrder.useMutation();
  // 模拟确认充值（开发测试用）
  const confirmRecharge = trpc.membership.confirmRecharge.useMutation();

  // 监听充值订单状态
  useEffect(() => {
    if (step === "paying" && rechargeStatus?.status === "paid") {
      refetchStatus();
      setStep("success");
    }
  }, [rechargeStatus, step, refetchStatus]);

  const finalAmount = customAmount ? parseFloat(customAmount) : amount;
  const isValidAmount = finalAmount >= 1 && finalAmount <= 10000 && !isNaN(finalAmount);
  const accountBalance = statusData?.accountBalance ?? 0;

  const handleRecharge = async () => {
    if (!isValidAmount) {
      setErrorMsg("请输入有效金额（1 ~ 10000 元）");
      return;
    }
    setErrorMsg("");
    try {
      const result = await createRechargeOrder.mutateAsync({
        amount: finalAmount,
        paymentChannel: channel,
      });
      setOrderId(result.orderId);

      if (result.channel === "wechat" && "mwebUrl" in result) {
        setStep("paying");
        window.location.href = result.mwebUrl;
        return;
      }
      if (result.channel === "alipay" && "formHtml" in result) {
        setStep("paying");
        const div = document.createElement("div");
        div.innerHTML = result.formHtml;
        document.body.appendChild(div);
        return;
      }
      setStep("paying");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "充值失败，请重试");
    }
  };

  const handleCheckPayment = async () => {
    if (!orderId) return;
    try {
      await confirmRecharge.mutateAsync({ orderId });
      await refetchStatus();
      setStep("success");
    } catch {
      setErrorMsg("暂未检测到支付成功，请稍后再试或联系客服");
    }
  };

  // 充值成功页
  if (step === "success") {
    return (
      <MobileLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-white text-lg font-bold mb-2">充值成功</h2>
          <p className="text-slate-400 text-sm mb-1">
            已成功充值 <span className="text-amber-400 font-bold">¥{finalAmount.toFixed(2)}</span>
          </p>
          <p className="text-slate-500 text-sm mb-6">
            当前余额：<span className="text-green-400 font-bold">¥{(statusData?.accountBalance ?? 0).toFixed(2)}</span>
          </p>
          <button
            onClick={() => setLocation("/app/user/wallet")}
            className="w-full max-w-xs h-12 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl"
          >
            返回钱包
          </button>
        </div>
      </MobileLayout>
    );
  }

  // 支付中页
  if (step === "paying") {
    return (
      <MobileLayout>
        <PageHeader title="等待支付" onBack={() => { setStep("select"); setOrderId(null); }} />
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 gap-4">
          <div className="w-12 h-12 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">
            充值金额：<span className="text-amber-400 font-bold">¥{finalAmount.toFixed(2)}</span>
          </p>
          <p className="text-slate-500 text-xs">正在等待支付结果...</p>
          {errorMsg && <p className="text-red-400 text-sm">{errorMsg}</p>}
        </div>
        <div className="px-4 pb-6 space-y-3">
          <button
            onClick={handleCheckPayment}
            disabled={confirmRecharge.isPending}
            className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl disabled:opacity-50"
          >
            {confirmRecharge.isPending ? "确认中..." : "我已完成支付"}
          </button>
          <button
            onClick={() => { setStep("select"); setOrderId(null); }}
            className="w-full h-12 bg-white/5 border border-white/10 text-slate-400 font-medium rounded-xl"
          >
            返回修改
          </button>
        </div>
      </MobileLayout>
    );
  }

  // 充值选择页
  return (
    <MobileLayout>
      <PageHeader title="账户充值" onBack={() => setLocation("/app/user/wallet")} />

      <div className="px-4 pb-6 space-y-4">
        {/* 当前余额 */}
        <div className="bg-gradient-to-br from-amber-600/30 via-purple-600/20 to-amber-800/10 backdrop-blur-xl border border-amber-500/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-amber-400" />
            <span className="text-amber-400/80 text-sm">当前余额</span>
          </div>
          <p className="text-2xl font-bold text-white">¥{accountBalance.toFixed(2)}</p>
        </div>

        {/* 充值金额选择 */}
        <GlassCard className="p-5">
          <h3 className="text-white font-semibold text-sm mb-3">选择充值金额</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                onClick={() => { setAmount(preset); setCustomAmount(""); }}
                className={`py-3 rounded-xl font-semibold text-sm transition-all ${
                  amount === preset && !customAmount
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                    : "bg-white/5 text-slate-400 border border-white/5"
                }`}
              >
                ¥{preset}
              </button>
            ))}
          </div>
          <input
            type="number"
            min="1"
            max="10000"
            placeholder="自定义金额（1-10000）"
            value={customAmount}
            onChange={(e) => {
              setCustomAmount(e.target.value);
              if (e.target.value) setAmount(0);
            }}
            className="w-full h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500/50"
          />
          {isValidAmount && (
            <p className="text-amber-400 text-sm mt-2 text-right font-medium">
              充值金额：¥{finalAmount.toFixed(2)}
            </p>
          )}
        </GlassCard>

        {/* 支付方式 */}
        <GlassCard className="p-5">
          <h3 className="text-white font-semibold text-sm mb-3">支付方式</h3>
          <div className="space-y-2">
            {[
              { key: "wechat" as const, label: "微信支付", color: "text-green-400", bg: "bg-green-500/10" },
              { key: "alipay" as const, label: "支付宝支付", color: "text-blue-400", bg: "bg-blue-500/10" },
            ].map((ch) => (
              <button
                key={ch.key}
                onClick={() => setChannel(ch.key)}
                className={`w-full p-4 rounded-xl flex items-center justify-between transition-all ${
                  channel === ch.key
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-white/5 border border-white/5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${ch.bg} flex items-center justify-center`}>
                    <CreditCard className={`w-5 h-5 ${ch.color}`} />
                  </div>
                  <span className="text-white font-medium">{ch.label}</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  channel === ch.key ? "border-amber-500 bg-amber-500" : "border-slate-600"
                }`}>
                  {channel === ch.key && <div className="w-2 h-2 rounded-full bg-black" />}
                </div>
              </button>
            ))}
          </div>
        </GlassCard>

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{errorMsg}</p>
          </div>
        )}

        {/* 确认按钮 */}
        <button
          onClick={handleRecharge}
          disabled={!isValidAmount || createRechargeOrder.isPending}
          className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {createRechargeOrder.isPending
            ? "处理中..."
            : isValidAmount
            ? `确认充值 ¥${finalAmount.toFixed(2)}`
            : "请选择充值金额"}
        </button>
      </div>
    </MobileLayout>
  );
}
