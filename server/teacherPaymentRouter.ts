import { router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { teacherPayments, orders, users } from "../drizzle/schema";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { getDb } from "./db";
import { USER_ROLES } from "../shared/roles";

// 老师权限中间件
const teacherProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.roles?.includes(USER_ROLES.TEACHER)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "需要老师权限",
    });
  }
  return next({ ctx });
});

// 财务权限中间件
const financeProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.user.roles?.includes(USER_ROLES.FINANCE) && !ctx.user.roles?.includes(USER_ROLES.ADMIN)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "需要财务或管理员权限",
    });
  }
  return next({ ctx });
});

export const teacherPaymentRouter = router({
  /**
   * 老师查询自己的收入记录
   */
  getMyPayments: teacherProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "paid"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      // 查找当前用户关联的老师ID
      const teacher = await database
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!teacher.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到老师信息" });
      }

      const teacherId = teacher[0].id;

      // 构建查询条件
      const conditions = [eq(teacherPayments.teacherId, teacherId)];

      if (input.status) {
        conditions.push(eq(teacherPayments.status, input.status));
      }

      if (input.startDate) {
        conditions.push(gte(teacherPayments.createdAt, new Date(input.startDate)));
      }

      if (input.endDate) {
        conditions.push(lte(teacherPayments.createdAt, new Date(input.endDate)));
      }

      // 查询支付记录，关联订单信息
      const payments = await database
        .select({
          id: teacherPayments.id,
          amount: teacherPayments.amount,
          status: teacherPayments.status,
          paymentMethod: teacherPayments.paymentMethod,
          transactionNo: teacherPayments.transactionNo,
          paymentTime: teacherPayments.paymentTime,
          notes: teacherPayments.notes,
          approvedAt: teacherPayments.approvedAt,
          createdAt: teacherPayments.createdAt,
          // 关联订单信息
          orderNo: orders.orderNo,
          customerName: orders.customerName,
          deliveryCourse: orders.deliveryCourse,
          classDate: orders.classDate,
        })
        .from(teacherPayments)
        .leftJoin(orders, eq(teacherPayments.orderId, orders.id))
        .where(and(...conditions))
        .orderBy(desc(teacherPayments.createdAt));

      return payments;
    }),

  /**
   * 管理员/财务查询所有老师的费用记录（用于审批页面）
   */
  getAllPayments: financeProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "paid"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      const conditions: any[] = [];

      if (input?.status) {
        conditions.push(eq(teacherPayments.status, input.status));
      }
      if (input?.startDate) {
        conditions.push(gte(teacherPayments.createdAt, new Date(input.startDate)));
      }
      if (input?.endDate) {
        conditions.push(lte(teacherPayments.createdAt, new Date(input.endDate)));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const payments = await database
        .select({
          id: teacherPayments.id,
          amount: teacherPayments.amount,
          status: teacherPayments.status,
          teacherId: teacherPayments.teacherId,
          teacherName: users.name,
          createdAt: teacherPayments.createdAt,
          notes: teacherPayments.notes,
        })
        .from(teacherPayments)
        .leftJoin(users, eq(teacherPayments.teacherId, users.id))
        .where(whereClause)
        .orderBy(desc(teacherPayments.createdAt));

      return payments.map(p => ({
        id: p.id,
        amount: p.amount ? parseFloat(p.amount.toString()) : 0,
        status: p.status,
        teacherName: p.teacherName || '未知老师',
        customerName: '',
        courseName: '',
        date: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : '',
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : '',
        notes: p.notes || '',
      }));
    }),

  /**
   * 老师查询收入统计
   */
  getPaymentStats: teacherProcedure.query(async ({ ctx }) => {
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

    const teacherId = ctx.user.id;

    // 统计各状态的金额
    const stats = await database
      .select({
        status: teacherPayments.status,
        totalAmount: sql<number>`COALESCE(SUM(${teacherPayments.amount}), 0)`,
        count: sql<number>`COUNT(*)`,
      })
      .from(teacherPayments)
      .where(eq(teacherPayments.teacherId, teacherId))
      .groupBy(teacherPayments.status);

    // 转换为对象格式
    const result = {
      pending: { amount: 0, count: 0 },
      approved: { amount: 0, count: 0 },
      paid: { amount: 0, count: 0 },
      total: { amount: 0, count: 0 },
    };

    stats.forEach((stat) => {
      const amount = parseFloat(stat.totalAmount.toString());
      const count = Number(stat.count);
      result[stat.status as keyof typeof result] = { amount, count };
      result.total.amount += amount;
      result.total.count += count;
    });

    return result;
  }),

  /**
   * 财务审批支付
   */
  approve: financeProcedure
    .input(
      z.object({
        id: z.number(),
        approved: z.boolean(), // true=批准, false=拒绝
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      // 查询当前记录
      const payment = await database
        .select()
        .from(teacherPayments)
        .where(eq(teacherPayments.id, input.id))
        .limit(1);

      if (!payment.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "支付记录不存在" });
      }

      if (payment[0].status !== "pending") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "只能审批待审批状态的记录" });
      }

      // 更新状态
      await database
        .update(teacherPayments)
        .set({
          status: input.approved ? "approved" : "pending",
          approvedBy: input.approved ? ctx.user.id : null,
          approvedAt: input.approved ? new Date() : null,
          notes: input.notes || payment[0].notes,
        })
        .where(eq(teacherPayments.id, input.id));

      return { success: true };
    }),

  /**
   * 财务标记为已支付
   */
  markAsPaid: financeProcedure
    .input(
      z.object({
        id: z.number(),
        paymentMethod: z.enum(["wechat", "alipay", "bank", "cash", "other"]),
        transactionNo: z.string().optional(),
        paymentTime: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      // 查询当前记录
      const payment = await database
        .select()
        .from(teacherPayments)
        .where(eq(teacherPayments.id, input.id))
        .limit(1);

      if (!payment.length) {
        throw new TRPCError({ code: "NOT_FOUND", message: "支付记录不存在" });
      }

      if (payment[0].status === "paid") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "该记录已支付" });
      }

      // 更新为已支付
      await database
        .update(teacherPayments)
        .set({
          status: "paid",
          paymentMethod: input.paymentMethod,
          transactionNo: input.transactionNo,
          paymentTime: input.paymentTime ? new Date(input.paymentTime) : new Date(),
          notes: input.notes || payment[0].notes,
        })
        .where(eq(teacherPayments.id, input.id));

      return { success: true };
    }),

  /**
   * 按月统计报表
   */
  getMonthlyReport: financeProcedure
    .input(
      z.object({
        year: z.number(),
        month: z.number().min(1).max(12),
      })
    )
    .query(async ({ input }) => {
      const database = await getDb();
      if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

      // 构建月份范围
      const startDate = new Date(input.year, input.month - 1, 1);
      const endDate = new Date(input.year, input.month, 0, 23, 59, 59);

      // 按老师统计
      const teacherStats = await database
        .select({
          teacherId: teacherPayments.teacherId,
          teacherName: users.name,
          totalAmount: sql<number>`COALESCE(SUM(${teacherPayments.amount}), 0)`,
          paidAmount: sql<number>`COALESCE(SUM(CASE WHEN ${teacherPayments.status} = 'paid' THEN ${teacherPayments.amount} ELSE 0 END), 0)`,
          approvedAmount: sql<number>`COALESCE(SUM(CASE WHEN ${teacherPayments.status} = 'approved' THEN ${teacherPayments.amount} ELSE 0 END), 0)`,
          pendingAmount: sql<number>`COALESCE(SUM(CASE WHEN ${teacherPayments.status} = 'pending' THEN ${teacherPayments.amount} ELSE 0 END), 0)`,
          count: sql<number>`COUNT(*)`,
        })
        .from(teacherPayments)
        .leftJoin(users, eq(teacherPayments.teacherId, users.id))
        .where(and(gte(teacherPayments.createdAt, startDate), lte(teacherPayments.createdAt, endDate)))
        .groupBy(teacherPayments.teacherId, users.name);

      // 总计
      const total = teacherStats.reduce(
        (acc, stat) => ({
          totalAmount: acc.totalAmount + parseFloat(stat.totalAmount.toString()),
          paidAmount: acc.paidAmount + parseFloat(stat.paidAmount.toString()),
          approvedAmount: acc.approvedAmount + parseFloat(stat.approvedAmount.toString()),
          pendingAmount: acc.pendingAmount + parseFloat(stat.pendingAmount.toString()),
          count: acc.count + Number(stat.count),
        }),
        { totalAmount: 0, paidAmount: 0, approvedAmount: 0, pendingAmount: 0, count: 0 }
      );

      return {
        year: input.year,
        month: input.month,
        teachers: teacherStats.map((stat) => ({
          teacherId: stat.teacherId,
          teacherName: stat.teacherName || "未知",
          totalAmount: parseFloat(stat.totalAmount.toString()),
          paidAmount: parseFloat(stat.paidAmount.toString()),
          approvedAmount: parseFloat(stat.approvedAmount.toString()),
          pendingAmount: parseFloat(stat.pendingAmount.toString()),
          count: Number(stat.count),
        })),
        total,
      };
    }),

  /**
   * 财务查询所有待审批的支付记录
   */
  getPendingPayments: financeProcedure.query(async () => {
    const database = await getDb();
    if (!database) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "数据库不可用" });

    const payments = await database
      .select({
        id: teacherPayments.id,
        teacherId: teacherPayments.teacherId,
        teacherName: users.name,
        amount: teacherPayments.amount,
        status: teacherPayments.status,
        notes: teacherPayments.notes,
        createdAt: teacherPayments.createdAt,
        // 关联订单信息
        orderNo: orders.orderNo,
        customerName: orders.customerName,
        deliveryCourse: orders.deliveryCourse,
        classDate: orders.classDate,
      })
      .from(teacherPayments)
      .leftJoin(users, eq(teacherPayments.teacherId, users.id))
      .leftJoin(orders, eq(teacherPayments.orderId, orders.id))
      .where(eq(teacherPayments.status, "pending"))
      .orderBy(desc(teacherPayments.createdAt));

    return payments;
  }),
});
