import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db.js";
import { schedules, teacherUnavailability, classrooms, users, userRoleCities } from "../drizzle/schema.js";
import { eq, and, or, sql, inArray } from "drizzle-orm";

/**
 * schedules 路由模块
 * 老师排班和时间段管理相关接口
 */
export const schedulesRouter = router({
  /**
   * 获取当前老师的排课列表
   * 老师端接口：强制使用JWT中的userId作为teacherId
   * 返回该老师所有的排课记录（用于日历视图和课程详情）
   */
  list: protectedProcedure
    .query(async ({ ctx }) => {
      // 检查用户角色
      if (!ctx.user.roles.includes('teacher')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only teachers can access schedule list',
        });
      }

      const teacherId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 查询该老师的所有排课记录
      const teacherSchedules = await db
        .select()
        .from(schedules)
        .where(eq(schedules.teacherId, teacherId))
        .orderBy(sql`${schedules.startTime} ASC`);

      // 格式化返回数据，兼容前端期望的字段
      return teacherSchedules.map(s => ({
        id: s.id,
        date: s.classDate ? new Date(s.classDate).toISOString().split('T')[0] : '',
        classTime: s.classTime || '',
        startTime: s.startTime ? new Date(s.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        endTime: s.endTime ? new Date(s.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '',
        courseName: s.deliveryCourse || s.courseType || '课程',
        deliveryCourse: s.deliveryCourse || '',
        customerName: s.customerName || '',
        cityName: s.city || '',
        room: '',
        teacherFee: null,
        notes: '',
        status: s.status || 'scheduled',
      }));
    }),

  /**
   * 获取老师排班可用性
   * 老师端接口：强制使用JWT中的userId，忽略前端传入的teacherId
   */
  getTeacherAvailability: protectedProcedure
    .input(
      z.object({
        teacherId: z.number().optional(), // 忽略此参数
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      // 检查用户角色
      if (!ctx.user.roles.includes('teacher')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only teachers can access this endpoint',
        });
      }

      // 强制使用JWT中的userId作为teacherId
      const teacherId = ctx.user.id;

      console.log('[schedules.getTeacherAvailability] Teacher ID:', teacherId);
      console.log('[schedules.getTeacherAvailability] Date range:', input?.startDate, '-', input?.endDate);

      // TODO: 实现真实的排班查询逻辑
      // 目前返回模拟数据
      return {
        teacherId,
        teacherName: ctx.user.name,
        availability: [
          {
            date: '2026-02-24',
            timeSlots: [
              { start: '09:00', end: '10:00', available: true },
              { start: '09:30', end: '10:30', available: true },
              { start: '10:00', end: '11:00', available: true },
              { start: '14:00', end: '15:00', available: false },
              { start: '15:00', end: '16:00', available: true },
            ],
          },
          {
            date: '2026-02-25',
            timeSlots: [
              { start: '09:00', end: '10:00', available: true },
              { start: '10:00', end: '11:00', available: false },
              { start: '14:00', end: '15:00', available: true },
              { start: '15:00', end: '16:00', available: true },
            ],
          },
        ],
      };
    }),

  /**
   * 获取指定城市和日期的可用时间段
   * 前端选择时间阶段调用此接口，过滤掉教室已满或无可用老师的时间段
   */
  getAvailableTimeSlots: publicProcedure
    .input(z.object({
      cityId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    }))
    .query(async ({ input }) => {
      const { cityId, date } = input;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 生成时间段列表（从当前时间+2小时到23:00，每半小时一个时间段）
      const now = new Date();
      const minTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 当前时间+2小时
      const minHour = minTime.getHours();
      const minMinute = minTime.getMinutes();
      
      // 向上取整到半点
      let startHour = minHour;
      let startMinute = minMinute <= 0 ? 0 : minMinute <= 30 ? 30 : 0;
      if (minMinute > 30) {
        startHour += 1;
      }

      const timeSlots: Array<{
        startTime: string;
        hasTeacher: boolean;
        hasClassroom: boolean;
        isAvailable: boolean;
      }> = [];

      // 生成从startHour:startMinute到22:30的所有半点时间段（课程开始时间不能晚于23:00）
      for (let hour = startHour; hour <= 22; hour++) {
        const minutes = hour === startHour ? [startMinute] : [0, 30];
        for (const minute of minutes) {
          if (hour === 22 && minute > 30) break; // 22:30是最后一个可选时间（确保课程开始时间不晚于23:00）

          const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          
          // 检查是否有可用老师（假设最短课程1小时）
          const cityTeachers = await db
            .select({ userId: userRoleCities.userId })
            .from(userRoleCities)
            .where(and(
              eq(userRoleCities.role, 'teacher'),
              sql`JSON_CONTAINS(${userRoleCities.cities}, ${JSON.stringify([cityId.toString()])})`
            ));

          const teacherIds = cityTeachers.map(t => t.userId);
          
          // 检查该时间段有预约的老师
          const startTimestamp = `${date} ${timeStr}:00`;
          const endTimestamp = `${date} ${String(hour + 1).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
          
          const busyTeachers = await db
            .select({ teacherId: schedules.teacherId })
            .from(schedules)
            .where(and(
              inArray(schedules.teacherId, teacherIds),
              or(
                and(
                  sql`${schedules.startTime} <= ${startTimestamp}`,
                  sql`${schedules.endTime} > ${startTimestamp}`
                ),
                and(
                  sql`${schedules.startTime} < ${endTimestamp}`,
                  sql`${schedules.endTime} >= ${endTimestamp}`
                )
              )
            ));

          const hasTeacher = teacherIds.length > busyTeachers.length;

          // 检查是否有可用教室
          const cityClassrooms = await db
            .select({ id: classrooms.id })
            .from(classrooms)
            .where(and(
              eq(classrooms.cityId, cityId),
              eq(classrooms.isActive, true)
            ));

          const classroomIds = cityClassrooms.map(c => c.id);
          
          const busyClassrooms = await db
            .select({ classroomId: schedules.classroomId })
            .from(schedules)
            .where(and(
              inArray(schedules.classroomId, classroomIds),
              or(
                and(
                  sql`${schedules.startTime} <= ${startTimestamp}`,
                  sql`${schedules.endTime} > ${startTimestamp}`
                ),
                and(
                  sql`${schedules.startTime} < ${endTimestamp}`,
                  sql`${schedules.endTime} >= ${endTimestamp}`
                )
              )
            ));

          const hasClassroom = classroomIds.length > busyClassrooms.length;

          timeSlots.push({
            startTime: timeStr,
            hasTeacher,
            hasClassroom,
            isAvailable: hasTeacher && hasClassroom,
          });
        }
      }

      return {
        success: true,
        data: {
          date,
          cityId,
          availableSlots: timeSlots,
        },
      };
    }),

  /**
   * 老师设置不接客时段
   * 老师端接口：强制使用JWT中的userId作为teacherId
   */
  setUnavailability: protectedProcedure
    .input(z.object({
      startTime: z.string().datetime(), // ISO 8601 format: "2026-02-24T14:00:00Z"
      endTime: z.string().datetime(),
      reason: z.string().max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 检查用户角色
      if (!ctx.user.roles.includes('teacher')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only teachers can set unavailability',
        });
      }

      const teacherId = ctx.user.id;
      const { startTime, endTime, reason } = input;

      // 验证时间
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (start >= end) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'End time must be after start time',
        });
      }

      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 插入不接客时段
      await db.insert(teacherUnavailability).values({
        teacherId,
        startTime: start,
        endTime: end,
        reason: reason || null,
      });

      return {
        success: true,
        message: 'Unavailability period set successfully',
      };
    }),

  /**
   * 查看老师的不接客时段列表
   * 老师端接口：强制使用JWT中的userId作为teacherId
   */
  listUnavailability: protectedProcedure
    .input(z.object({
      startDate: z.string().optional(), // YYYY-MM-DD
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      // 检查用户角色
      if (!ctx.user.roles.includes('teacher')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only teachers can view unavailability',
        });
      }

      const teacherId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 查询不接客时段
      const conditions = [eq(teacherUnavailability.teacherId, teacherId)];
      
      if (input?.startDate) {
        conditions.push(sql`${teacherUnavailability.endTime} >= ${input.startDate}`);
      }
      if (input?.endDate) {
        conditions.push(sql`${teacherUnavailability.startTime} <= ${input.endDate}`);
      }

      const result = await db
        .select()
        .from(teacherUnavailability)
        .where(and(...conditions));

      return {
        success: true,
        data: result,
      };
    }),

  /**
   * 删除不接客时段
   * 老师端接口：强制使用JWT中的userId验证权限
   */
  deleteUnavailability: protectedProcedure
    .input(z.object({
      id: z.number().int().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      // 检查用户角色
      if (!ctx.user.roles.includes('teacher')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only teachers can delete unavailability',
        });
      }

      const teacherId = ctx.user.id;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 验证该记录属于当前老师
      const record = await db
        .select()
        .from(teacherUnavailability)
        .where(eq(teacherUnavailability.id, input.id))
        .limit(1);

      if (record.length === 0) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Unavailability record not found',
        });
      }

      if (record[0].teacherId !== teacherId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only delete your own unavailability records',
        });
      }

      // 删除记录
      await db
        .delete(teacherUnavailability)
        .where(eq(teacherUnavailability.id, input.id));

      return {
        success: true,
        message: 'Unavailability period deleted successfully',
      };
    }),

  /**
   * 获取所有排课记录（包含订单信息）
   * 管理端接口：返回所有排课记录
   */
  listWithOrderInfo: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 查询所有排课记录
      const allSchedules = await db
        .select()
        .from(schedules)
        .orderBy(sql`${schedules.startTime} DESC`);

      return allSchedules;
    }),
});
