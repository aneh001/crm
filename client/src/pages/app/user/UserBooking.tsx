import { useState } from "react";
import MobileLayout from "../components/MobileLayout";
import { GlassCard, PageHeader, LoadingSpinner, EmptyState } from "../components/GlassCard";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { MapPin, Calendar, User, Clock, ChevronRight, Check } from "lucide-react";

type BookingStep = "city" | "date" | "teacher" | "time" | "confirm";

export default function UserBooking() {
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<BookingStep>("city");
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");

  const steps: { key: BookingStep; label: string; icon: any }[] = [
    { key: "city", label: "选城市", icon: MapPin },
    { key: "date", label: "选日期", icon: Calendar },
    { key: "teacher", label: "选老师", icon: User },
    { key: "time", label: "选时段", icon: Clock },
    { key: "confirm", label: "确认", icon: Check },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  const goBack = () => {
    if (currentStepIndex > 0) {
      setStep(steps[currentStepIndex - 1].key);
    } else {
      setLocation("/app/user");
    }
  };

  return (
    <MobileLayout>
      <PageHeader title="课程预约" onBack={goBack} />

      {/* 步骤指示器 */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === currentStepIndex;
            const isDone = i < currentStepIndex;
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${
                      isActive
                        ? "bg-amber-500 text-black"
                        : isDone
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-white/5 text-slate-600"
                    }`}
                  >
                    {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-3.5 h-3.5" />}
                  </div>
                  <span className={`text-[10px] mt-1 ${isActive ? "text-amber-400" : "text-slate-600"}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-6 h-px mx-1 mt-[-12px] ${i < currentStepIndex ? "bg-amber-500/30" : "bg-white/5"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 pb-6">
        {step === "city" && (
          <CityStep
            onSelect={(city) => {
              setSelectedCity(city);
              setStep("date");
            }}
          />
        )}
        {step === "date" && (
          <DateStep
            onSelect={(date) => {
              setSelectedDate(date);
              setStep("teacher");
            }}
          />
        )}
        {step === "teacher" && (
          <TeacherStep
            cityId={selectedCity?.id}
            onSelect={(teacher) => {
              setSelectedTeacher(teacher);
              setStep("time");
            }}
          />
        )}
        {step === "time" && (
          <TimeStep
            cityId={selectedCity?.id}
            date={selectedDate}
            onSelect={(time) => {
              setSelectedTime(time);
              setStep("confirm");
            }}
          />
        )}
        {step === "confirm" && (
          <ConfirmStep
            city={selectedCity}
            date={selectedDate}
            teacher={selectedTeacher}
            time={selectedTime}
            onConfirm={() => setLocation("/app/user/orders")}
          />
        )}
      </div>
    </MobileLayout>
  );
}

function CityStep({ onSelect }: { onSelect: (city: any) => void }) {
  const citiesQuery = trpc.city.list.useQuery(undefined, { retry: false });
  
  if (citiesQuery.isLoading) return <LoadingSpinner />;
  
  const cities = citiesQuery.data || [];
  if (cities.length === 0) return <EmptyState message="暂无可预约城市" />;

  return (
    <div className="space-y-2">
      <h2 className="text-white font-semibold mb-3">选择城市</h2>
      {cities.map((city: any) => (
        <GlassCard
          key={city.id}
          className="p-4 flex items-center justify-between"
          onClick={() => onSelect(city)}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-medium">{city.name}</p>
              {city.address && <p className="text-slate-500 text-xs mt-0.5">{city.address}</p>}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </GlassCard>
      ))}
    </div>
  );
}

function DateStep({ onSelect }: { onSelect: (date: string) => void }) {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }

  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];

  return (
    <div className="space-y-3">
      <h2 className="text-white font-semibold">选择日期</h2>
      <div className="grid grid-cols-4 gap-2">
        {dates.map((date) => {
          const d = new Date(date + "T00:00:00");
          const isToday = date === today.toISOString().split("T")[0];
          return (
            <GlassCard
              key={date}
              className="p-3 text-center"
              onClick={() => onSelect(date)}
            >
              <p className="text-slate-400 text-xs">周{weekDays[d.getDay()]}</p>
              <p className="text-white font-bold text-lg mt-0.5">
                {d.getDate()}
              </p>
              <p className="text-slate-500 text-[10px]">
                {isToday ? "今天" : `${d.getMonth() + 1}月`}
              </p>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}

function TeacherStep({ cityId, onSelect }: { cityId?: number; onSelect: (teacher: any) => void }) {
  const teachersQuery = trpc.booking.getTeachers.useQuery(
    { cityId: cityId || 0 },
    { retry: false, enabled: !!cityId }
  );

  if (teachersQuery.isLoading) return <LoadingSpinner />;

  const teachers = teachersQuery.data || [];
  if (teachers.length === 0) return <EmptyState message="暂无可选老师" />;

  return (
    <div className="space-y-2">
      <h2 className="text-white font-semibold mb-3">选择老师</h2>
      {teachers.map((teacher: any) => (
        <GlassCard
          key={teacher.id}
          className="p-4 flex items-center justify-between"
          onClick={() => onSelect(teacher)}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/30 to-amber-500/30 flex items-center justify-center overflow-hidden">
              {teacher.avatarUrl ? (
                <img src={teacher.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-white">{(teacher.name || "?")[0]}</span>
              )}
            </div>
            <div>
              <p className="text-white font-medium">{teacher.name}</p>
              {teacher.teacherAttribute && (
                <span className="text-xs text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                  {teacher.teacherAttribute}
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </GlassCard>
      ))}
    </div>
  );
}

function TimeStep({ cityId, date, onSelect }: { cityId?: number; date: string; onSelect: (time: string) => void }) {
  const slotsQuery = trpc.schedules.getAvailableTimeSlots.useQuery(
    { cityId: cityId || 0, date },
    { retry: false, enabled: !!cityId && !!date }
  );

  if (slotsQuery.isLoading) return <LoadingSpinner />;

  const slots = slotsQuery.data?.data?.availableSlots || (slotsQuery.data as any)?.timeSlots || [];
  const available = slots.filter((s: any) => s.isAvailable);

  if (available.length === 0) return <EmptyState message="该日期暂无可用时段" />;

  return (
    <div className="space-y-3">
      <h2 className="text-white font-semibold">选择时段</h2>
      <div className="grid grid-cols-3 gap-2">
        {available.map((slot: any) => (
          <GlassCard
            key={slot.startTime}
            className="p-3 text-center"
            onClick={() => onSelect(slot.startTime)}
          >
            <p className="text-white font-medium">{slot.startTime}</p>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

function ConfirmStep({
  city, date, teacher, time, onConfirm,
}: {
  city: any; date: string; teacher: any; time: string; onConfirm: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createBooking = trpc.booking.create.useMutation({
    onSuccess: () => {
      onConfirm();
    },
    onError: (err) => {
      alert(err.message || "预约失败");
      setIsSubmitting(false);
    },
  });

  const handleConfirm = () => {
    setIsSubmitting(true);
    createBooking.mutate({
      cityId: city?.id,
      teacherId: teacher?.id,
      date,
      startTime: time,
      courseItems: [{ courseId: 0, duration: 60, price: 0 }], // 默认课程项（待用户选择）
    });
  };

  return (
    <div className="space-y-4">
      <h2 className="text-white font-semibold">确认预约信息</h2>
      <GlassCard className="p-5 space-y-4">
        <div className="flex justify-between">
          <span className="text-slate-400 text-sm">城市</span>
          <span className="text-white text-sm">{city?.name}</span>
        </div>
        <div className="border-t border-white/5" />
        <div className="flex justify-between">
          <span className="text-slate-400 text-sm">日期</span>
          <span className="text-white text-sm">{date}</span>
        </div>
        <div className="border-t border-white/5" />
        <div className="flex justify-between">
          <span className="text-slate-400 text-sm">老师</span>
          <span className="text-white text-sm">{teacher?.name}</span>
        </div>
        <div className="border-t border-white/5" />
        <div className="flex justify-between">
          <span className="text-slate-400 text-sm">时段</span>
          <span className="text-white text-sm">{time}</span>
        </div>
      </GlassCard>
      <button
        onClick={handleConfirm}
        disabled={isSubmitting}
        className="w-full h-12 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-xl active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {isSubmitting ? "提交中..." : "确认预约"}
      </button>
    </div>
  );
}
