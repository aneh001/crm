import MobileLayout from "../components/MobileLayout";
import { GlassCard, StatCard } from "../components/GlassCard";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Calendar, Clock, BookOpen, DollarSign, ChevronRight } from "lucide-react";

export default function TeacherHome() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const userName = (user as any)?.nickname || (user as any)?.name || "老师";

  // 获取排课数据
  const schedulesQuery = trpc.schedules.list.useQuery(undefined, { retry: false });
  const paymentsQuery = trpc.teacherPayments.getMyPayments.useQuery({}, { retry: false });

  const schedules = schedulesQuery.data || [];
  const payments = paymentsQuery.data || [];

  const today = new Date().toISOString().split("T")[0];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  // 今日课程
  const todayCourses = schedules.filter((s: any) => (s.date || "").startsWith(today));
  
  // 本周课程
  const weekCourses = schedules.filter((s: any) => {
    const d = new Date(s.date || "");
    return d >= weekStart && d <= weekEnd;
  });

  // 本月结算
  const thisMonth = today.substring(0, 7);
  const monthPayments = payments.filter((p: any) => (p.createdAt || "").startsWith(thisMonth));
  const monthEarnings = monthPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

  return (
    <MobileLayout>
      <div className="px-4 pt-6 pb-4 space-y-5">
        {/* 欢迎区域 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{userName}老师</h1>
            <p className="text-slate-500 text-sm mt-0.5">今日课程安排</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{userName[0]}</span>
          </div>
        </div>

        {/* 数据卡片 */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="今日课程"
            value={`${todayCourses.length} 节`}
            icon={<Calendar className="w-4 h-4" />}
            color="blue"
          />
          <StatCard
            label="本周排课"
            value={`${weekCourses.length} 节`}
            icon={<Clock className="w-4 h-4" />}
            color="green"
          />
          <StatCard
            label="本月课时费"
            value={`¥${monthEarnings.toFixed(0)}`}
            icon={<DollarSign className="w-4 h-4" />}
            color="amber"
          />
          <StatCard
            label="总课程数"
            value={schedules.length}
            icon={<BookOpen className="w-4 h-4" />}
            color="purple"
          />
        </div>

        {/* 今日课程列表 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">今日课程</h2>
            <button
              onClick={() => setLocation("/app/teacher/schedule")}
              className="text-amber-400 text-xs flex items-center gap-0.5"
            >
              查看排课 <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {todayCourses.length === 0 ? (
            <GlassCard className="p-6 text-center text-slate-500 text-sm">
              今日暂无课程安排
            </GlassCard>
          ) : (
            <div className="space-y-2">
              {todayCourses.map((course: any) => (
                <GlassCard key={course.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium text-sm">
                      {course.courseName || course.deliveryCourse || "课程"}
                    </span>
                    <span className="text-amber-400 text-xs">
                      {course.startTime || course.classTime || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {course.customerName && <span>学员: {course.customerName}</span>}
                    {course.cityName && <span>· {course.cityName}</span>}
                    {course.room && <span>· {course.room}</span>}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        {/* 本周概览 */}
        <div>
          <h2 className="text-white font-semibold mb-3">本周排课概览</h2>
          <WeekOverview schedules={schedules} />
        </div>
      </div>
    </MobileLayout>
  );
}

function WeekOverview({ schedules }: { schedules: any[] }) {
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const count = schedules.filter((s: any) => (s.date || "").startsWith(dateStr)).length;
    const isToday = dateStr === today.toISOString().split("T")[0];
    return { date: d, dateStr, count, isToday, dayName: weekDays[i] };
  });

  return (
    <div className="grid grid-cols-7 gap-1">
      {days.map((day) => (
        <div
          key={day.dateStr}
          className={`text-center p-2 rounded-xl ${
            day.isToday ? "bg-amber-500/20 border border-amber-500/30" : "bg-white/[0.02]"
          }`}
        >
          <p className={`text-[10px] ${day.isToday ? "text-amber-400" : "text-slate-600"}`}>
            周{day.dayName}
          </p>
          <p className={`text-sm font-bold mt-0.5 ${day.isToday ? "text-white" : "text-slate-400"}`}>
            {day.date.getDate()}
          </p>
          {day.count > 0 && (
            <div className={`w-1.5 h-1.5 rounded-full mx-auto mt-1 ${
              day.isToday ? "bg-amber-400" : "bg-blue-400"
            }`} />
          )}
          {day.count > 0 && (
            <p className="text-[9px] text-slate-500 mt-0.5">{day.count}节</p>
          )}
        </div>
      ))}
    </div>
  );
}
