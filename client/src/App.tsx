import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Orders from "./pages/Orders";
import Customers from "./pages/Customers";
import Teachers from "./pages/Teachers";
import Schedules from "./pages/Schedules";
import TeacherPayments from "./pages/TeacherPayments";
import Reconciliations from "./pages/Reconciliations";
import Finance from "./pages/Finance";
import Analytics from "./pages/Analytics";
import Users from "./pages/Users";

import CustomerOverview from "./pages/CustomerOverview";
import Sales from "./pages/Sales";
// Gmail导入功能已移除
// import GmailImport from "./pages/GmailImport";
// import GmailImportConfig from "./pages/GmailImportConfig";
import ChannelOrderNoManagement from "./pages/ChannelOrderNoManagement";
import ReconciliationExport from "./pages/ReconciliationExport";
import TransportFeeFixTool from "./pages/TransportFeeFixTool";
import TrafficSourceConfig from "./pages/TrafficSourceConfig";
import TrafficSourceDashboard from "./pages/TrafficSourceDashboard";

import CityPartnerConfig from "./pages/CityPartnerConfig";
import Cities from "./pages/Cities";
import ReconciliationMatch from "./pages/ReconciliationMatch";
import ReconciliationReport from "./pages/ReconciliationReport";

import LocalLogin from "./pages/LocalLogin";
import ForgotPassword from "./pages/ForgotPassword";

import CustomerManagement from "./pages/CustomerManagement";
import Courses from "./pages/Courses";
import Notifications from "./pages/Notifications";
import SalesCityPerformance from "./pages/SalesCityPerformance";
import TeacherPaymentApproval from "./pages/TeacherPaymentApproval";
import PartnerManagement from "./pages/PartnerManagement";
import CityExpenseManagement from "@/pages/CityExpenseManagement";
import DataCleaning from "@/pages/DataCleaning";
import MembershipH5 from "@/pages/MembershipH5";
import Recharge from "@/pages/Recharge";

// ===== 移动端App页面 =====
import AppLogin from "./pages/app/AppLogin";
// 用户端
import UserHome from "./pages/app/user/UserHome";
import UserBooking from "./pages/app/user/UserBooking";
import UserOrders from "./pages/app/user/UserOrders";
import UserWallet from "./pages/app/user/UserWallet";
import UserProfile from "./pages/app/user/UserProfile";
// 销售端
import SalesHome from "./pages/app/sales/SalesHome";
import SalesRegister from "./pages/app/sales/SalesRegister";
import SalesCustomers from "./pages/app/sales/SalesCustomers";
import SalesOrders from "./pages/app/sales/SalesOrders";
import SalesCommission from "./pages/app/sales/SalesCommission";
// 老师端
import TeacherHome from "./pages/app/teacher/TeacherHome";
import TeacherSchedule from "./pages/app/teacher/TeacherSchedule";
import TeacherCourses from "./pages/app/teacher/TeacherCourses";
import TeacherSettlement from "./pages/app/teacher/TeacherSettlement";
import TeacherProfile from "./pages/app/teacher/TeacherProfile";
// 管理员端
import AdminHome from "./pages/app/admin/AdminHome";
import AdminOrders from "./pages/app/admin/AdminOrders";
import AdminCustomers from "./pages/app/admin/AdminCustomers";
import AdminApproval from "./pages/app/admin/AdminApproval";
import AdminStats from "./pages/app/admin/AdminStats";// 移动端 App入口重定向
import AppRedirect from "./pages/app/AppRedirect";
import AppRecharge from "./pages/app/user/AppRecharge";


function Router() {
  return (
    <Switch>
      {/* ===== 移动端App路由（/app 前缀）===== */}
      <Route path={"/app"} component={AppRedirect} />
      <Route path={"/app/login"} component={AppLogin} />
      {/* 用户端 */}
      <Route path={"/app/user"} component={UserHome} />
      <Route path={"/app/user/booking"} component={UserBooking} />
      <Route path={"/app/user/orders"} component={UserOrders} />
      <Route path={"/app/user/wallet"} component={UserWallet} />
      <Route path={"/app/user/profile"} component={UserProfile} />
      <Route path={"/app/user/recharge"} component={AppRecharge} />
      {/* 销售端 */}
      <Route path={"/app/sales"} component={SalesHome} />
      <Route path={"/app/sales/register"} component={SalesRegister} />
      <Route path={"/app/sales/customers"} component={SalesCustomers} />
      <Route path={"/app/sales/orders"} component={SalesOrders} />
      <Route path={"/app/sales/commission"} component={SalesCommission} />
      {/* 老师端 */}
      <Route path={"/app/teacher"} component={TeacherHome} />
      <Route path={"/app/teacher/schedule"} component={TeacherSchedule} />
      <Route path={"/app/teacher/courses"} component={TeacherCourses} />
      <Route path={"/app/teacher/settlement"} component={TeacherSettlement} />
      <Route path={"/app/teacher/profile"} component={TeacherProfile} />
      {/* 管理员端 */}
      <Route path={"/app/admin"} component={AdminHome} />
      <Route path={"/app/admin/orders"} component={AdminOrders} />
      <Route path={"/app/admin/customers"} component={AdminCustomers} />
      <Route path={"/app/admin/approval"} component={AdminApproval} />
      <Route path={"/app/admin/stats"} component={AdminStats} />

      {/* ===== 原有PC后台路由 ===== */}
      <Route path={"/"} component={Home} />
      <Route path={"/orders"} component={Orders} />
      <Route path={"/customer-management"} component={CustomerManagement} />
      <Route path={"/customers"} component={Customers} />
      <Route path={"/teachers"} component={Teachers} />
      <Route path={"/schedules"} component={Schedules} />
      <Route path={"/teacher-payments"} component={TeacherPayments} />
      <Route path={"/reconciliations"} component={Reconciliations} />
      <Route path={"/finance"} component={Finance} />
      <Route path={"/analytics"} component={Analytics} />
      <Route path={"/users"} component={Users} />

      <Route path={"/customer-overview"} component={CustomerOverview} />
      <Route path={"/sales"} component={Sales} />
      {/* Gmail导入功能已移除 */}
      {/* <Route path={"/gmail-import"} component={GmailImport} /> */}
      {/* <Route path={"/gmail-import/config"} component={GmailImportConfig} /> */}
      <Route path={"/channel-orderno-management"} component={ChannelOrderNoManagement} />
      <Route path={"/reconciliation-export"} component={ReconciliationExport} />
      <Route path={"/transport-fee-fix"} component={TransportFeeFixTool} />
      <Route path={"/traffic-source-config"} component={TrafficSourceConfig} />
      <Route path={"/traffic-source-dashboard"} component={TrafficSourceDashboard} />

      <Route path={"/city-partner-config"} component={CityPartnerConfig} />
      <Route path={"/cities"} component={Cities} />
      <Route path={"/reconciliation-match"} component={ReconciliationMatch} />
      <Route path={"/reconciliation-report"} component={ReconciliationReport} />

      <Route path={"/login"} component={LocalLogin} />
      <Route path={"/forgot-password"} component={ForgotPassword} />

      <Route path={"/courses"} component={Courses} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/sales-city-performance"} component={SalesCityPerformance} />
      <Route path={"/teacher-payment-approval"} component={TeacherPaymentApproval} />
      <Route path={"/partner-management"} component={PartnerManagement} />
      <Route path={"/city-expense-management"} component={CityExpenseManagement} />
      <Route path={"/data-cleaning"} component={DataCleaning} />
      <Route path={"/membership"} component={MembershipH5} />
      <Route path={"/recharge"} component={Recharge} />

      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
