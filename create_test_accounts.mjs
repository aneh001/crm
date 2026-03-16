/**
 * 创建标准测试账号脚本
 * 
 * 使用方法：node create_test_accounts.mjs
 * 
 * 需要环境变量：
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * 或直接修改下方连接配置
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'yingji-crm.mysql.rds.aliyuncs.com',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'vanni526',
  password: process.env.DB_PASSWORD || 'Coolra88bs',
  database: process.env.DB_NAME || 'yingji-crm',
};

const TEST_ACCOUNTS = [
  { name: '测试管理员', phone: '13800138000', password: '123456', roles: 'admin' },
  { name: '测试销售', phone: '13800138001', password: '123456', roles: 'sales' },
  { name: '测试老师', phone: '13800138002', password: '123456', roles: 'teacher' },
  { name: '测试用户', phone: '13800138003', password: '123456', roles: 'user' },
];

async function main() {
  console.log('连接数据库...');
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log('数据库连接成功');

  for (const account of TEST_ACCOUNTS) {
    const hashedPassword = await bcrypt.hash(account.password, 10);
    
    // 检查是否已存在
    const [existing] = await conn.execute(
      'SELECT id, phone, roles FROM users WHERE phone = ?',
      [account.phone]
    );

    if (existing.length > 0) {
      // 更新已有账号
      await conn.execute(
        'UPDATE users SET name = ?, password = ?, roles = ?, isActive = 1 WHERE phone = ?',
        [account.name, hashedPassword, account.roles, account.phone]
      );
      console.log(`✅ 更新账号: ${account.name} (${account.phone}) - 角色: ${account.roles}`);
    } else {
      // 创建新账号
      await conn.execute(
        'INSERT INTO users (name, phone, password, roles, isActive) VALUES (?, ?, ?, ?, 1)',
        [account.name, account.phone, hashedPassword, account.roles]
      );
      console.log(`✅ 创建账号: ${account.name} (${account.phone}) - 角色: ${account.roles}`);
    }
  }

  // 验证所有测试账号
  console.log('\n--- 验证测试账号 ---');
  const [allAccounts] = await conn.execute(
    'SELECT id, name, phone, roles, isActive FROM users WHERE phone IN (?, ?, ?, ?)',
    TEST_ACCOUNTS.map(a => a.phone)
  );
  console.table(allAccounts);

  await conn.end();
  console.log('\n✅ 测试账号创建/更新完成！');
  console.log('\n测试账号列表：');
  TEST_ACCOUNTS.forEach(a => {
    console.log(`  ${a.roles.padEnd(8)} - 手机号: ${a.phone} / 密码: ${a.password}`);
  });
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
