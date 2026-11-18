import { Navigate, Outlet, Route, Routes } from 'react-router-dom';

import ProtectedRoute from './components/ProtectedRoute';
import PlatformProtectedRoute from './components/PlatformProtectedRoute';
import { PlatformAuthProvider } from './context/PlatformAuthContext';
import AppLayout from './layouts/AppLayout';
import PlatformLayout from './layouts/PlatformLayout';
import LoginPage from './pages/LoginPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import VehiclesListPage from './pages/VehiclesListPage';
import VehicleFormPage from './pages/VehicleFormPage';
import VehicleDetailPage from './pages/VehicleDetailPage';
import MachineryListPage from './pages/MachineryListPage';
import MachineryFormPage from './pages/MachineryFormPage';
import MachineryDetailPage from './pages/MachineryDetailPage';
import SitesPage from './pages/SitesPage';
import SiteManagementPage from './pages/site-management/SiteManagementPage';
import ItemCatalogPage from './pages/inventory/ItemCatalogPage';
import StockMovementsPage from './pages/inventory/StockMovementsPage';
import PurchaseFormPage from './pages/inventory/PurchaseFormPage';
import PurchaseDetailPage from './pages/inventory/PurchaseDetailPage';
import StockPage from './pages/inventory/StockPage';
import AssetIssueFormPage from './pages/inventory/AssetIssueFormPage';
import AssetIssueDetailPage from './pages/inventory/AssetIssueDetailPage';
import StockAdjustmentFormPage from './pages/inventory/StockAdjustmentFormPage';
import StockAdjustmentDetailPage from './pages/inventory/StockAdjustmentDetailPage';
import StockTransferFormPage from './pages/inventory/StockTransferFormPage';
import StockTransferDetailPage from './pages/inventory/StockTransferDetailPage';
import InventoryReportsPage from './pages/inventory/InventoryReportsPage';
import TyreStockPage from './pages/tyres/TyreStockPage';
import TyrePurchasesPage from './pages/tyres/TyrePurchasesPage';
import TyrePurchaseFormPage from './pages/tyres/TyrePurchaseFormPage';
import TyrePurchaseDetailPage from './pages/tyres/TyrePurchaseDetailPage';
import TyreFittingPage from './pages/tyres/TyreFittingPage';
import TyreFitFormPage from './pages/tyres/TyreFitFormPage';
import TyreReportsPage from './pages/tyres/TyreReportsPage';
import BatteriesPage from './pages/batteries/BatteriesPage';
import AddBatteriesPage from './pages/batteries/AddBatteriesPage';
import BatteryHistoryPage from './pages/batteries/BatteryHistoryPage';
import BatteryDetailPage from './pages/batteries/BatteryDetailPage';
import FuelStockPage from './pages/fuel/FuelStockPage';
import FuelCollectionsPage from './pages/fuel/FuelCollectionsPage';
import FuelCollectionFormPage from './pages/fuel/FuelCollectionFormPage';
import FuelCollectionDetailPage from './pages/fuel/FuelCollectionDetailPage';
import FuelIssuesPage from './pages/fuel/FuelIssuesPage';
import FuelIssueFormPage from './pages/fuel/FuelIssueFormPage';
import FuelReportsPage from './pages/fuel/FuelReportsPage';
import ExternalFuelPage from './pages/fuel/ExternalFuelPage';
import ExternalFuelFormPage from './pages/fuel/ExternalFuelFormPage';
import FuelStationsPage from './pages/fuel/FuelStationsPage';
import AdBlueOverviewPage from './pages/adblue/AdBlueOverviewPage';
import AdBluePurchasesPage from './pages/adblue/AdBluePurchasesPage';
import AdBluePurchaseFormPage from './pages/adblue/AdBluePurchaseFormPage';
import AdBlueFillingsPage from './pages/adblue/AdBlueFillingsPage';
import AdBlueFillingFormPage from './pages/adblue/AdBlueFillingFormPage';
import AdBlueReportsPage from './pages/adblue/AdBlueReportsPage';
import PreventiveMaintenancePage from './pages/maintenance/PreventiveMaintenancePage';
import BreakdownMaintenancePage from './pages/maintenance/BreakdownMaintenancePage';
import MaintenanceHistoryPage from './pages/maintenance/MaintenanceHistoryPage';
import ComplianceDocumentsPage from './pages/compliance/ComplianceDocumentsPage';
import ForbiddenPage from './pages/ForbiddenPage';
import NotFoundPage from './pages/NotFoundPage';
import PlatformLoginPage from './pages/platform/PlatformLoginPage';
import PlatformAccountPage from './pages/platform/PlatformAccountPage';
import PlatformOverviewPage from './pages/platform/PlatformOverviewPage';
import PlatformActivityPage from './pages/platform/PlatformActivityPage';
import FeatureFlagsPage from './pages/platform/FeatureFlagsPage';
import TenantsListPage from './pages/platform/TenantsListPage';
import TenantFormPage from './pages/platform/TenantFormPage';
import TenantDetailPage from './pages/platform/TenantDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePasswordPage />
          </ProtectedRoute>
        }
      />

      {/* Super Admin area: its own sign-in and session, separate from any organization. */}
      <Route
        element={
          <PlatformAuthProvider>
            <Outlet />
          </PlatformAuthProvider>
        }
      >
        <Route path="/platform/login" element={<PlatformLoginPage />} />
        <Route
          element={
            <PlatformProtectedRoute>
              <PlatformLayout />
            </PlatformProtectedRoute>
          }
        >
          <Route path="/platform" element={<Navigate to="/platform/tenants" replace />} />
          <Route path="/platform/overview" element={<PlatformOverviewPage />} />
          <Route path="/platform/activity" element={<PlatformActivityPage />} />
          <Route path="/platform/feature-flags" element={<FeatureFlagsPage />} />
          <Route path="/platform/tenants" element={<TenantsListPage />} />
          <Route path="/platform/tenants/new" element={<TenantFormPage />} />
          <Route path="/platform/tenants/:tenantId" element={<TenantDetailPage />} />
          <Route path="/platform/tenants/:tenantId/edit" element={<TenantFormPage />} />
          <Route path="/platform/account" element={<PlatformAccountPage />} />
        </Route>
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="/vehicles" element={<VehiclesListPage />} />
        <Route path="/vehicles/new" element={<VehicleFormPage />} />
        <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
        <Route path="/vehicles/:id/edit" element={<VehicleFormPage />} />
        <Route path="/machinery" element={<MachineryListPage />} />
        <Route path="/machinery/new" element={<MachineryFormPage />} />
        <Route path="/machinery/:id" element={<MachineryDetailPage />} />
        <Route path="/machinery/:id/edit" element={<MachineryFormPage />} />
        <Route
          path="/sites"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SitesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/site-management" element={<SiteManagementPage />} />

        <Route path="/maintenance" element={<Navigate to="/maintenance/preventive" replace />} />
        <Route path="/maintenance/preventive" element={<PreventiveMaintenancePage />} />
        <Route path="/maintenance/breakdowns" element={<BreakdownMaintenancePage />} />
        <Route path="/maintenance/history" element={<MaintenanceHistoryPage />} />

        <Route path="/compliance" element={<ComplianceDocumentsPage />} />

        <Route path="/inventory/catalog" element={<ItemCatalogPage />} />

        <Route path="/inventory/stock" element={<StockPage />} />

        <Route path="/inventory/movements" element={<StockMovementsPage />} />
        <Route path="/inventory/reports" element={<InventoryReportsPage />} />
        <Route path="/inventory/purchases/new" element={<PurchaseFormPage />} />
        <Route path="/inventory/purchases/:id" element={<PurchaseDetailPage />} />
        <Route path="/inventory/purchases/:id/edit" element={<PurchaseFormPage />} />
        <Route path="/inventory/asset-issues/new" element={<AssetIssueFormPage />} />
        <Route path="/inventory/asset-issues/:id" element={<AssetIssueDetailPage />} />
        <Route path="/inventory/stock-adjustments/new" element={<StockAdjustmentFormPage />} />
        <Route path="/inventory/stock-adjustments/:id" element={<StockAdjustmentDetailPage />} />
        <Route
          path="/inventory/stock-transfers/new"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StockTransferFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stock-transfers/:id"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <StockTransferDetailPage />
            </ProtectedRoute>
          }
        />

        <Route path="/fuel/stock" element={<FuelStockPage />} />
        <Route path="/fuel/collections" element={<FuelCollectionsPage />} />
        <Route path="/fuel/collections/new" element={<FuelCollectionFormPage />} />
        <Route path="/fuel/collections/:id" element={<FuelCollectionDetailPage />} />
        <Route path="/fuel/collections/:id/edit" element={<FuelCollectionFormPage />} />
        <Route path="/fuel/issues" element={<FuelIssuesPage />} />
        <Route path="/fuel/issues/new" element={<FuelIssueFormPage />} />
        <Route path="/fuel/issues/:id/edit" element={<FuelIssueFormPage />} />
        <Route path="/fuel/external" element={<ExternalFuelPage />} />
        <Route path="/fuel/external/new" element={<ExternalFuelFormPage />} />
        <Route path="/fuel/external/:id/edit" element={<ExternalFuelFormPage />} />
        <Route path="/fuel/reports" element={<FuelReportsPage />} />
        <Route
          path="/fuel/stations"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <FuelStationsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/adblue" element={<Navigate to="/adblue/overview" replace />} />
        <Route path="/adblue/overview" element={<AdBlueOverviewPage />} />
        <Route path="/adblue/purchases" element={<AdBluePurchasesPage />} />
        <Route path="/adblue/purchases/new" element={<AdBluePurchaseFormPage />} />
        <Route path="/adblue/purchases/:id/edit" element={<AdBluePurchaseFormPage />} />
        <Route path="/adblue/fillings" element={<AdBlueFillingsPage />} />
        <Route path="/adblue/fillings/new" element={<AdBlueFillingFormPage />} />
        <Route path="/adblue/fillings/:id/edit" element={<AdBlueFillingFormPage />} />
        <Route path="/adblue/reports" element={<AdBlueReportsPage />} />

        <Route path="/tyres" element={<Navigate to="/tyres/stock" replace />} />
        <Route path="/tyres/stock" element={<TyreStockPage />} />
        <Route path="/tyres/purchases" element={<TyrePurchasesPage />} />
        <Route path="/tyres/purchases/new" element={<TyrePurchaseFormPage />} />
        <Route path="/tyres/purchases/:id" element={<TyrePurchaseDetailPage />} />
        <Route path="/tyres/fitting" element={<TyreFittingPage />} />
        <Route path="/tyres/fitting/new" element={<TyreFitFormPage />} />
        <Route path="/tyres/reports" element={<TyreReportsPage />} />

        <Route path="/batteries" element={<BatteriesPage />} />
        <Route path="/batteries/add" element={<AddBatteriesPage />} />
        <Route path="/batteries/history" element={<BatteryHistoryPage />} />
        <Route path="/batteries/:id" element={<BatteryDetailPage />} />

        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
