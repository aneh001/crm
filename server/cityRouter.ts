import { router, protectedProcedure } from "./_core/trpc";
import ExcelJS from "exceljs";
import * as db from "./db";
import { cityPartnerConfig } from "../drizzle/schema";

export const cityRouter = router({
  // 获取所有城市列表
  getAll: protectedProcedure.query(async () => {
    const cities = await db.getAllCities();
    return cities;
  }),
  // 获取城市列表（移动端别名，与getAll相同逻辑）
  list: protectedProcedure.query(async () => {
    const cities = await db.getAllCities();
    return cities;
  }),
  // 获取城市月度业绩趋势数据
  getCityMonthlyTrends: protectedProcedure.query(async () => {
    const monthlyTrends = await db.getCityMonthlyTrends();
    return monthlyTrends;
  }),
  exportCities: protectedProcedure.query(async () => {
    // 获取所有城市的财务统计数据
    const cityStats = await db.getCityFinancialStats();
    
    // 获取城市配置信息
    const dbInstance = await db.getDb();
    if (!dbInstance) throw new Error("Database not available");
    const citiesConfig = await dbInstance.select().from(cityPartnerConfig);
    
    // 创建城市配置映射
    const cityConfigMap = new Map(
      citiesConfig.map((c) => [c.city, c])
    );

    // 创建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("城市统计");

    // 设置列头
    worksheet.columns = [
      { header: "城市名称", key: "city", width: 15 },
      { header: "区号", key: "areaCode", width: 10 },
      { header: "合伙人费比例", key: "partnerFeeRate", width: 15 },
      { header: "订单数", key: "orderCount", width: 12 },
      { header: "销售额", key: "revenue", width: 15 },
      { header: "老师费用", key: "teacherFee", width: 15 },
      { header: "车费", key: "transportFee", width: 12 },
      { header: "耗材费用", key: "consumablesFee", width: 15 },
      { header: "房租费用", key: "rentFee", width: 15 },
      { header: "物业费用", key: "propertyFee", width: 15 },
      { header: "水电费用", key: "utilityFee", width: 15 },
      { header: "其他费用", key: "otherFee", width: 15 },
      { header: "总费用", key: "totalCost", width: 15 },
      { header: "净利润", key: "profit", width: 15 },
      { header: "利润率", key: "profitMargin", width: 12 },
      { header: "状态", key: "status", width: 10 },
    ];

    // 设置表头样式
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // 填充数据
    cityStats.forEach((stat) => {
      const config = cityConfigMap.get(stat.city);
      worksheet.addRow({
        city: stat.city,
        areaCode: config?.areaCode || "-",
        partnerFeeRate: config?.partnerFeeRate ? `${(parseFloat(config.partnerFeeRate) * 100).toFixed(2)}%` : "0%",
        orderCount: stat.orderCount,
        revenue: stat.totalRevenue,
        teacherFee: stat.teacherFee,
        transportFee: stat.transportFee,
        consumablesFee: stat.consumablesFee,
        rentFee: stat.rentFee,
        propertyFee: stat.propertyFee,
        utilityFee: stat.utilityFee,
        otherFee: stat.otherFee,
        totalCost: stat.totalExpense,
        profit: stat.profit,
        profitMargin: `${stat.profitMargin.toFixed(2)}%`,
        status: config?.isActive ? "启用" : "禁用",
      });
    });

    // 设置数字格式
    const numberColumns = ["revenue", "teacherFee", "transportFee", "consumablesFee", "rentFee", "propertyFee", "utilityFee", "otherFee", "totalCost", "profit"];
    numberColumns.forEach((colKey) => {
      const col = worksheet.getColumn(colKey);
      col.numFmt = "¥#,##0.00";
    });

    // 生成Buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // 返回Base64编码的Excel文件
    return {
      data: Buffer.from(buffer).toString("base64"),
      filename: `城市统计报表_${new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })}.xlsx`,
    };
  }),
});
