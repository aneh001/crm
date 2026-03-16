import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc.js";
import { getDb } from "./db.js";
import { classrooms, schedules, orders, orderItems, courses, teachers, users, userRoleCities } from "../drizzle/schema.js";
import { eq, and, or, sql, inArray, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { generateOrderNo } from "./orderNoGenerator.js";

export const bookingRouter = router({
  /**
   * 获取指定城市的可用老师列表
   * 用户端预约流程中选择老师时调用
   */
  getTeachers: publicProcedure
    .input(z.object({
      cityId: z.number().int().positive(),
    }))
    .query(async ({ input }) => {
      const { cityId } = input;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 查找该城市的所有老师
      const cityTeachers = await db
        .select({
          userId: userRoleCities.userId,
        })
        .from(userRoleCities)
        .where(and(
          eq(userRoleCities.role, 'teacher'),
          sql`JSON_CONTAINS(${userRoleCities.cities}, ${JSON.stringify([cityId.toString()])})`
        ));

      const teacherIds = cityTeachers.map(t => t.userId);
      if (teacherIds.length === 0) {
        return [];
      }

      // 查询老师详细信息
      const teacherList = await db
        .select({
          id: users.id,
          name: users.name,
          nickname: users.nickname,
          avatarUrl: users.avatarUrl,
          teacherAttribute: users.teacherAttribute,
        })
        .from(users)
        .where(and(
          inArray(users.id, teacherIds),
          eq(users.isActive, true)
        ));

      return teacherList;
    }),

  /**
   * 获取指定城市、日期、总时长的所有可用时间段
   * 返回可用的开始时间列表
   * 考虑教室容量和现有预约
   */
  getAvailableSlots: publicProcedure
    .input(z.object({
      cityId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      totalDuration: z.number().positive(), // 总时长(小时)
      teacherId: z.number().int().positive().optional(), // 可选，指定老师
    }))
    .query(async ({ input }) => {
      const { cityId, date, totalDuration, teacherId } = input;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 1. 获取该城市的所有启用的教室
      const cityClassrooms = await db
        .select({
          id: classrooms.id,
          name: classrooms.name,
          sortOrder: classrooms.sortOrder,
          capacity: classrooms.capacity,
        })
        .from(classrooms)
        .where(and(
          eq(classrooms.cityId, cityId),
          eq(classrooms.isActive, true)
        ))
        .orderBy(asc(classrooms.sortOrder));

      if (cityClassrooms.length === 0) {
        return {
          success: true,
          data: [],
          message: '该城市暂无可用教室',
        };
      }

      // 2. 获取该日期所有教室的预约记录
      const dateStart = `${date} 00:00:00`;
      const dateEnd = `${date} 23:59:59`;
      
      const existingBookingsRaw = await db
        .select({
          classroomId: schedules.classroomId,
          startTime: schedules.startTime,
          endTime: schedules.endTime,
          teacherId: schedules.teacherId,
        })
        .from(schedules)
        .where(and(
          sql`${schedules.startTime} >= ${dateStart}`,
          sql`${schedules.startTime} < ${dateEnd}`
        ));

      // 数据库连接已设置 timezone: "+08:00"，Drizzle 返回的 Date 对象已是北京时间
      // 直接用本地时间方法格式化为 "YYYY-MM-DD HH:mm:ss" 字符串用于冲突检测
      const formatLocalTime = (d: Date | string | null): string => {
        if (!d) return '';
        if (typeof d === 'string') return d;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      };

      const existingBookings = existingBookingsRaw.map(b => ({
        ...b,
        startTimeStr: formatLocalTime(b.startTime as Date | string | null),
        endTimeStr: formatLocalTime(b.endTime as Date | string | null),
      }));

      // 3. 生成所有可能的时间段（从09:00到23:00，每30分钟一个时间点）
      const availableSlots: string[] = [];
      
      // 使用UTC+8时区（北京时间）计算最早预约时间
      const now = new Date();
      const nowInBeijing = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
      const twoHoursLater = new Date(nowInBeijing.getTime() + 2 * 60 * 60 * 1000);
      
      // 向上取整到下一个半点（12:38+2小时=14:38→15:00）
      const minutes = twoHoursLater.getMinutes();
      let minBookingHour = twoHoursLater.getHours();
      let minBookingMinute = 0;
      
      if (minutes > 0 && minutes <= 30) {
        minBookingMinute = 30;
      } else if (minutes > 30) {
        minBookingHour += 1;
        minBookingMinute = 0;
      }
      
      // 判断查询日期是否是今天（北京时间）
      const todayInBeijing = nowInBeijing.toISOString().split('T')[0]; // YYYY-MM-DD格式
      const isToday = date === todayInBeijing;
      
      // 只对今天应用2小时限制
      let minBookingTime: Date | null = null;
      if (isToday) {
        const minBookingTimeStr = `${date}T${String(minBookingHour).padStart(2, '0')}:${String(minBookingMinute).padStart(2, '0')}:00+08:00`;
        minBookingTime = new Date(minBookingTimeStr);
      }

      for (let hour = 9; hour <= 23; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const startTime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
          
          // 开始时间最晚为23:00，所以当hour=23且minute=30时跳过
          if (hour === 23 && minute === 30) {
            continue;
          }
          
          // 使用UTC+8时区解析日期时间
          const startDateTime = new Date(`${date}T${startTime}:00+08:00`);
          const endDateTime = new Date(startDateTime.getTime() + totalDuration * 60 * 60 * 1000);
          
          // 检查是否是过去的时间或不满足提前2小时的要求（仅对今天）
          if (minBookingTime && startDateTime < minBookingTime) {
            continue;
          }

          const startTimestamp = `${date} ${startTime}:00`;
          const endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;
          const endTimestamp = `${date} ${endTime}:00`;

          // 4. 检查是否有至少一个教室可用
          let hasAvailableClassroom = false;
          
          for (const classroom of cityClassrooms) {
            // 统计该教室在该时间段的预约数量
            const conflictingBookings = existingBookings.filter(booking => {
              if (booking.classroomId !== classroom.id) return false;
              
              // 检查时间冲突（统一使用北京时间字符串比较，避免 Drizzle Date 对象时区问题）
              const bookingStart = new Date(booking.startTimeStr).getTime();
              const bookingEnd = new Date(booking.endTimeStr).getTime();
              const slotStart = new Date(startTimestamp).getTime();
              const slotEnd = new Date(endTimestamp).getTime();
              
              return (
                (bookingStart <= slotStart && bookingEnd > slotStart) ||
                (bookingStart < slotEnd && bookingEnd >= slotEnd) ||
                (bookingStart >= slotStart && bookingEnd <= slotEnd)
              );
            });
            
            // 如果预约数量小于教室容量，则该教室可用
            if (conflictingBookings.length < (classroom.capacity || 1)) {
              // 如果指定了老师，检查老师是否可用
              if (teacherId) {
                const teacherConflict = existingBookings.some(booking => {
                  if (booking.teacherId !== teacherId) return false;
                  
                  const bookingStart = new Date(booking.startTimeStr).getTime();
                  const bookingEnd = new Date(booking.endTimeStr).getTime();
                  const slotStart = new Date(startTimestamp).getTime();
                  const slotEnd = new Date(endTimestamp).getTime();
                  
                  return (
                    (bookingStart <= slotStart && bookingEnd > slotStart) ||
                    (bookingStart < slotEnd && bookingEnd >= slotEnd) ||
                    (bookingStart >= slotStart && bookingEnd <= slotEnd)
                  );
                });
                
                if (teacherConflict) {
                  continue; // 老师不可用，检查下一个教室
                }
              }
              
              hasAvailableClassroom = true;
              break;
            }
          }
          
          if (hasAvailableClassroom) {
            availableSlots.push(startTime);
          }
        }
      }

      return {
        success: true,
        data: availableSlots,
        message: availableSlots.length > 0 ? `找到${availableSlots.length}个可用时间段` : '该日期暂无可用时间段',
      };
    }),
  /**
   * 获取指定城市、时间段的可用教室
   * 按sortOrder优先级返回第一个可用的教室
   */
  getAvailableClassroom: publicProcedure
    .input(z.object({
      cityId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
      duration: z.number().positive(), // 课程时长(小时)
    }))
    .query(async ({ input }) => {
      const { cityId, date, startTime, duration } = input;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 计算结束时间
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDateTime = new Date(`${date}T${startTime}:00`);
      const endDateTime = new Date(startDateTime.getTime() + duration * 60 * 60 * 1000);
      const endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;

      const startTimestamp = `${date} ${startTime}:00`;
      const endTimestamp = `${date} ${endTime}:00`;

      // 获取该城市的所有教室（按sortOrder升序）
      const cityClassrooms = await db
        .select({
          id: classrooms.id,
          name: classrooms.name,
          sortOrder: classrooms.sortOrder,
          capacity: classrooms.capacity,
        })
        .from(classrooms)
        .where(and(
          eq(classrooms.cityId, cityId),
          eq(classrooms.isActive, true)
        ))
        .orderBy(asc(classrooms.sortOrder));

      if (cityClassrooms.length === 0) {
        return {
          success: true,
          data: null,
          message: '该城市暂无可用教室',
        };
      }

      // 遍历教室，找到第一个可用的
      for (const classroom of cityClassrooms) {
        // 检查该教室在该时间段的预约数量
        const bookings = await db
          .select({ id: schedules.id })
          .from(schedules)
          .where(and(
            eq(schedules.classroomId, classroom.id),
            or(
              // 新预约开始时间在现有预约时间段内
              and(
                sql`${schedules.startTime} <= ${startTimestamp}`,
                sql`${schedules.endTime} > ${startTimestamp}`
              ),
              // 新预约结束时间在现有预约时间段内
              and(
                sql`${schedules.startTime} < ${endTimestamp}`,
                sql`${schedules.endTime} >= ${endTimestamp}`
              ),
              // 新预约完全包含现有预约
              and(
                sql`${schedules.startTime} >= ${startTimestamp}`,
                sql`${schedules.endTime} <= ${endTimestamp}`
              )
            )
          ));

        // 如果预约数量小于教室容量，则该教室可用
        if (bookings.length < (classroom.capacity || 1)) {
          return {
            success: true,
            data: {
              id: classroom.id,
              name: classroom.name,
              sortOrder: classroom.sortOrder,
              capacity: classroom.capacity,
              currentBookings: bookings.length,
            },
          };
        }
      }

      // 所有教室都满了
      return {
        success: true,
        data: null,
        message: '该时间段所有教室已满',
      };
    }),

  /**
   * 创建预约
   * 支持多课程预约
   * 自动分配教室（如果未指定）
   * 创建schedules记录和orders记录
   */
  create: protectedProcedure
    .input(z.object({
      cityId: z.number().int().positive(),
      teacherId: z.number().int().positive(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
      startTime: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
      classroomId: z.number().int().positive().optional(), // 可选，不传则自动分配
      courseItems: z.array(z.object({
        courseId: z.number().int().positive(),
        quantity: z.number().int().positive().default(1),
        duration: z.number().positive(), // 课程时长(小时)
        price: z.number().positive(), // 课程单价
      })).min(1),
      transportFee: z.number().nonnegative().optional(), // 车费（可选）
      customerNote: z.string().max(500).optional(), // 客户备注
    }))
    .mutation(async ({ ctx, input }) => {
      const { cityId, teacherId, date, startTime, classroomId, courseItems, transportFee, customerNote } = input;
      const db = await getDb();
      if (!db) throw new Error("Database connection failed");

      // 1. 时间验证
      const now = new Date();
      const [hours, minutes] = startTime.split(':').map(Number);
      
      // 检查开始时间是否是整点或半点
      if (minutes !== 0 && minutes !== 30) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '开始时间必须是整点或半点（如10:00或10:30）',
        });
      }

      const bookingDateTime = new Date(`${date}T${startTime}:00`);
      
      // 检查是否是过去的时间
      if (bookingDateTime < now) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '不能预约过去的时间',
        });
      }

      // 检查是否距离当前时间至少2小时
      const minBookingTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      if (bookingDateTime < minBookingTime) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '预约时间必须在当前时间2小时之后',
        });
      }

      // 检查开始时间是否超过23:00
      if (hours >= 23) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: '最晚可预约时间为23:00',
        });
      }

      // 2. 计算总时长和总价格
      const totalDuration = courseItems.reduce((sum, item) => sum + item.duration * item.quantity, 0);
      const totalPrice = courseItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const endDateTime = new Date(bookingDateTime.getTime() + totalDuration * 60 * 60 * 1000);
      const endTime = `${String(endDateTime.getHours()).padStart(2, '0')}:${String(endDateTime.getMinutes()).padStart(2, '0')}`;

      // 结束时间允许超过23:00，不需要校验

      // 3. 查询老师名称
      const teacherResult = await db
        .select({ name: teachers.name })
        .from(teachers)
        .where(eq(teachers.id, teacherId))
        .limit(1);
      const teacherName = teacherResult[0]?.name || '';

      // 3.5 自动分配教室（如果未指定）
      let finalClassroomId = classroomId;
      if (!finalClassroomId) {
        const availableClassrooms = await db
          .select()
          .from(classrooms)
          .where(and(
            eq(classrooms.cityId, cityId),
            eq(classrooms.isActive, true)
          ))
          .orderBy(asc(classrooms.sortOrder))
          .limit(1);
        
        const availableClassroom = availableClassrooms[0];

        if (!availableClassroom) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '该城市暂无可用教室',
          });
        }

        finalClassroomId = availableClassroom.id;
      }

      // 4. 使用数据库事务确保原子性操作，防止并发冲突
      const startTimestamp = `${date} ${startTime}:00`;
      const endTimestamp = `${date} ${endTime}:00`;

      // 开始事务
      return await db.transaction(async (tx) => {
        // 4.1 使用FOR UPDATE锁定相关教室记录，防止并发冲突
        const classroomResult = await tx
          .select()
          .from(classrooms)
          .where(eq(classrooms.id, finalClassroomId!))
          .limit(1)
          .for('update');
        
        const classroom = classroomResult[0];
        // 从教室记录获取城市名（classrooms 表有 cityName 冗余字段）
        const cityName = classroom?.cityName || '';
        
        if (!classroom) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: '教室不存在',
          });
        }

        // 4.2 检查教室容量和时间冲突
        const classroomBookings = await tx
          .select({ id: schedules.id })
          .from(schedules)
          .where(and(
            eq(schedules.classroomId, finalClassroomId),
            or(
              and(
                sql`${schedules.startTime} <= ${startTimestamp}`,
                sql`${schedules.endTime} > ${startTimestamp}`
              ),
              and(
                sql`${schedules.startTime} < ${endTimestamp}`,
                sql`${schedules.endTime} >= ${endTimestamp}`
              ),
              and(
                sql`${schedules.startTime} >= ${startTimestamp}`,
                sql`${schedules.endTime} <= ${endTimestamp}`
              )
            )
          ));

        if (classroomBookings.length >= (classroom.capacity || 1)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '抱歉，该时间段已被其他用户预约，请选择其他时间',
          });
        }

        // 4.3 检查老师时间冲突
        const teacherBookings = await tx
          .select({ id: schedules.id })
          .from(schedules)
          .where(and(
            eq(schedules.teacherId, teacherId),
            or(
              and(
                sql`${schedules.startTime} <= ${startTimestamp}`,
                sql`${schedules.endTime} > ${startTimestamp}`
              ),
              and(
                sql`${schedules.startTime} < ${endTimestamp}`,
                sql`${schedules.endTime} >= ${endTimestamp}`
              ),
              and(
                sql`${schedules.startTime} >= ${startTimestamp}`,
                sql`${schedules.endTime} <= ${endTimestamp}`
              )
            )
          ));

        if (teacherBookings.length > 0) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: '抱歉，该老师在此时间段已有其他课程安排，请选择其他老师或时间',
          });
        }

        // 5. 创建 orders记录（在事务内）
        const orderNo = generateOrderNo();
        const orderResult = await tx.insert(orders).values({
        orderNo,
        customerId: ctx.user.id,
        customerName: ctx.user.name || '',
        salesId: ctx.user.id, // 必需字段
        paymentAmount: totalPrice.toString(),
        courseAmount: totalPrice.toString(),
        transportFee: transportFee ? transportFee.toString() : '0.00',
        classDate: new Date(date),
        classTime: `${startTime}-${endTime}`,
        status: 'pending',
        notes: customerNote || null,
        // 补全交付信息字段
        deliveryCity: cityName,
        deliveryRoom: classroom?.name || '',
        deliveryClassroomId: finalClassroomId,
        deliveryTeacher: teacherName,
        paymentStatus: 'unpaid',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
        const orderId = Number(orderResult[0].insertId);

        // 6. 创建 order_items记录并获取课程名称（在事务内）
        const orderItemsData: Array<{ orderItemId: number; courseId: number; courseName: string; quantity: number; duration: number }> = [];
        
        for (const item of courseItems) {
          // 查询课程名称
          const courseResult = await tx
            .select({ name: courses.name })
            .from(courses)
            .where(eq(courses.id, item.courseId))
            .limit(1);
          
          const courseName = courseResult[0]?.name || `课程${item.courseId}`;
          
          const orderItemResult = await tx.insert(orderItems).values({
          orderId,
          courseId: item.courseId,
          courseName,
          quantity: item.quantity,
          price: item.price.toString(),
          subtotal: (item.price * item.quantity).toString(),
          duration: item.duration.toString(),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        
          const orderItemId = Number(orderItemResult[0].insertId);
          orderItemsData.push({
            orderItemId,
            courseId: item.courseId,
            courseName,
            quantity: item.quantity,
            duration: item.duration,
          });
        }

        // 7. 为每个课程创建多条 schedules记录（每节课1条）（在事务内）
        const scheduleIds: number[] = [];
        let currentStartTime = new Date(startTimestamp);
        
        for (const itemData of orderItemsData) {
          for (let i = 0; i < itemData.quantity; i++) {
            const currentEndTime = new Date(currentStartTime.getTime() + itemData.duration * 60 * 60 * 1000);
            
            const scheduleResult = await tx.insert(schedules).values({
            orderId,
            orderItemId: itemData.orderItemId,
            customerId: ctx.user.id,
            customerName: ctx.user.name || '',
            teacherId,
            classroomId: finalClassroomId,
            courseType: itemData.courseName,
            deliveryCourse: itemData.courseName, // 设置 deliveryCourse字段
            classDate: new Date(date),
            classTime: `${currentStartTime.getHours().toString().padStart(2, '0')}:${currentStartTime.getMinutes().toString().padStart(2, '0')}-${currentEndTime.getHours().toString().padStart(2, '0')}:${currentEndTime.getMinutes().toString().padStart(2, '0')}`,
            startTime: currentStartTime,
            endTime: currentEndTime,
            city: cityName, // 从教室记录获取城市名
            status: 'scheduled',
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          
            scheduleIds.push(Number(scheduleResult[0].insertId));
            
            // 更新下一节课的开始时间
            currentStartTime = currentEndTime;
          }
        }

        // 8. 更新orders表的deliveryCourse字段（逗号分隔，支持x2简化显示）（在事务内）
        const deliveryCourseMap = new Map<string, number>();
        for (const itemData of orderItemsData) {
          const count = deliveryCourseMap.get(itemData.courseName) || 0;
          deliveryCourseMap.set(itemData.courseName, count + itemData.quantity);
        }
        
        const deliveryCourseStr = Array.from(deliveryCourseMap.entries())
          .map(([courseName, count]) => count > 1 ? `${courseName} x${count}` : courseName)
          .join(', ');
        
        await tx.update(orders)
          .set({ deliveryCourse: deliveryCourseStr })
          .where(eq(orders.id, orderId));

        return {
          success: true,
          data: {
            scheduleIds, // 返回所有创建的排课 ID
            orderId,
            orderNo,
            classroomId: finalClassroomId,
            totalDuration,
            totalPrice,
            transportFee: transportFee || 0,
            startTime,
            endTime,
            deliveryCourse: deliveryCourseStr,
          },
          message: '预约创建成功',
        };
      }); // 结束事务
    }),
});
