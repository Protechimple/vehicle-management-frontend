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
import AccessPage from './pages/AccessPage';
import TeamPage from './pages/TeamPage';
import ProfilePage from './pages/ProfilePage';
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
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/access"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AccessPage />
            </ProtectedRoute>
          }
        />
        <Route path="/team" element={<ProtectedRoute anyOf={[['USERS', 'VIEW_TEAM']]}><TeamPage /></ProtectedRoute>} />
        <Route path="/vehicles" element={<ProtectedRoute anyOf={[['VEHICLE', 'READ']]}><VehiclesListPage /></ProtectedRoute>} />
        <Route path="/vehicles/new" element={<ProtectedRoute anyOf={[['VEHICLE', 'CREATE']]}><VehicleFormPage /></ProtectedRoute>} />
        <Route path="/vehicles/:id" element={<ProtectedRoute anyOf={[['VEHICLE', 'READ']]}><VehicleDetailPage /></ProtectedRoute>} />
        <Route path="/vehicles/:id/edit" element={<ProtectedRoute anyOf={[['VEHICLE', 'UPDATE']]}><VehicleFormPage /></ProtectedRoute>} />
        <Route path="/machinery" element={<ProtectedRoute anyOf={[['MACHINERY', 'READ']]}><MachineryListPage /></ProtectedRoute>} />
        <Route path="/machinery/new" element={<ProtectedRoute anyOf={[['MACHINERY', 'CREATE']]}><MachineryFormPage /></ProtectedRoute>} />
        <Route path="/machinery/:id" element={<ProtectedRoute anyOf={[['MACHINERY', 'READ']]}><MachineryDetailPage /></ProtectedRoute>} />
        <Route path="/machinery/:id/edit" element={<ProtectedRoute anyOf={[['MACHINERY', 'UPDATE']]}><MachineryFormPage /></ProtectedRoute>} />
        <Route
          path="/sites"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <SitesPage />
            </ProtectedRoute>
          }
        />
        <Route path="/site-management" element={<ProtectedRoute anyOf={[['VEHICLE', 'READ'], ['MACHINERY', 'READ']]}><SiteManagementPage /></ProtectedRoute>} />

        <Route path="/maintenance" element={<Navigate to="/maintenance/preventive" replace />} />
        <Route path="/maintenance/preventive" element={<ProtectedRoute anyOf={[['MAINTENANCE', 'READ']]}><PreventiveMaintenancePage /></ProtectedRoute>} />
        <Route path="/maintenance/breakdowns" element={<ProtectedRoute anyOf={[['MAINTENANCE', 'READ']]}><BreakdownMaintenancePage /></ProtectedRoute>} />
        <Route path="/maintenance/history" element={<ProtectedRoute anyOf={[['MAINTENANCE', 'READ']]}><MaintenanceHistoryPage /></ProtectedRoute>} />

        <Route path="/compliance" element={<ProtectedRoute anyOf={[['COMPLIANCE', 'READ']]}><ComplianceDocumentsPage /></ProtectedRoute>} />

        <Route path="/inventory/catalog" element={<ProtectedRoute anyOf={[['ITEM', 'READ'], ['ITEM_CATEGORY', 'READ'], ['UOM', 'READ'], ['SUPPLIER', 'READ']]}><ItemCatalogPage /></ProtectedRoute>} />

        <Route path="/inventory/stock" element={<ProtectedRoute anyOf={[['STOCK', 'READ']]}><StockPage /></ProtectedRoute>} />

        <Route path="/inventory/movements" element={<ProtectedRoute anyOf={[['PURCHASE', 'READ'], ['ASSET_ISSUE', 'READ'], ['STOCK_ADJUSTMENT', 'READ'], ['STOCK_TRANSFER', 'READ']]}><StockMovementsPage /></ProtectedRoute>} />
        <Route path="/inventory/reports" element={<ProtectedRoute allOf={[['STOCK', 'READ'], ['REPORTS', 'VIEW']]}><InventoryReportsPage /></ProtectedRoute>} />
        <Route path="/inventory/purchases/new" element={<ProtectedRoute anyOf={[['PURCHASE', 'CREATE']]}><PurchaseFormPage /></ProtectedRoute>} />
        <Route path="/inventory/purchases/:id" element={<ProtectedRoute anyOf={[['PURCHASE', 'READ']]}><PurchaseDetailPage /></ProtectedRoute>} />
        <Route path="/inventory/purchases/:id/edit" element={<ProtectedRoute anyOf={[['PURCHASE', 'UPDATE']]}><PurchaseFormPage /></ProtectedRoute>} />
        <Route path="/inventory/asset-issues/new" element={<ProtectedRoute anyOf={[['ASSET_ISSUE', 'CREATE']]}><AssetIssueFormPage /></ProtectedRoute>} />
        <Route path="/inventory/asset-issues/:id" element={<ProtectedRoute anyOf={[['ASSET_ISSUE', 'READ']]}><AssetIssueDetailPage /></ProtectedRoute>} />
        <Route path="/inventory/stock-adjustments/new" element={<ProtectedRoute anyOf={[['STOCK_ADJUSTMENT', 'CREATE']]}><StockAdjustmentFormPage /></ProtectedRoute>} />
        <Route path="/inventory/stock-adjustments/:id" element={<ProtectedRoute anyOf={[['STOCK_ADJUSTMENT', 'READ']]}><StockAdjustmentDetailPage /></ProtectedRoute>} />
        <Route
          path="/inventory/stock-transfers/new"
          element={
            <ProtectedRoute anyOf={[['STOCK_TRANSFER', 'CREATE']]}>
              <StockTransferFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stock-transfers/:id"
          element={
            <ProtectedRoute anyOf={[['STOCK_TRANSFER', 'READ']]}>
              <StockTransferDetailPage />
            </ProtectedRoute>
          }
        />

        <Route path="/fuel/stock" element={<ProtectedRoute anyOf={[['FUEL_STOCK', 'READ']]}><FuelStockPage /></ProtectedRoute>} />
        <Route path="/fuel/collections" element={<ProtectedRoute anyOf={[['FUEL_COLLECTION', 'READ']]}><FuelCollectionsPage /></ProtectedRoute>} />
        <Route path="/fuel/collections/new" element={<ProtectedRoute anyOf={[['FUEL_COLLECTION', 'CREATE']]}><FuelCollectionFormPage /></ProtectedRoute>} />
        <Route path="/fuel/collections/:id" element={<ProtectedRoute anyOf={[['FUEL_COLLECTION', 'READ']]}><FuelCollectionDetailPage /></ProtectedRoute>} />
        <Route path="/fuel/collections/:id/edit" element={<ProtectedRoute anyOf={[['FUEL_COLLECTION', 'UPDATE']]}><FuelCollectionFormPage /></ProtectedRoute>} />
        <Route path="/fuel/issues" element={<ProtectedRoute anyOf={[['FUEL', 'READ']]}><FuelIssuesPage /></ProtectedRoute>} />
        <Route path="/fuel/issues/new" element={<ProtectedRoute anyOf={[['FUEL', 'CREATE']]}><FuelIssueFormPage /></ProtectedRoute>} />
        <Route path="/fuel/issues/:id/edit" element={<ProtectedRoute anyOf={[['FUEL', 'UPDATE']]}><FuelIssueFormPage /></ProtectedRoute>} />
        <Route path="/fuel/external" element={<ProtectedRoute anyOf={[['FUEL', 'READ']]}><ExternalFuelPage /></ProtectedRoute>} />
        <Route path="/fuel/external/new" element={<ProtectedRoute anyOf={[['FUEL', 'CREATE']]}><ExternalFuelFormPage /></ProtectedRoute>} />
        <Route path="/fuel/external/:id/edit" element={<ProtectedRoute anyOf={[['FUEL', 'UPDATE']]}><ExternalFuelFormPage /></ProtectedRoute>} />
        <Route path="/fuel/reports" element={<ProtectedRoute allOf={[['FUEL', 'READ'], ['REPORTS', 'VIEW']]}><FuelReportsPage /></ProtectedRoute>} />
        <Route
          path="/fuel/stations"
          element={
            <ProtectedRoute anyOf={[['FUEL_STATION', 'CREATE'], ['FUEL_STATION', 'UPDATE']]}>
              <FuelStationsPage />
            </ProtectedRoute>
          }
        />

        <Route path="/adblue" element={<Navigate to="/adblue/overview" replace />} />
        <Route path="/adblue/overview" element={<ProtectedRoute anyOf={[['ADBLUE', 'READ']]}><AdBlueOverviewPage /></ProtectedRoute>} />
        <Route path="/adblue/purchases" element={<ProtectedRoute anyOf={[['ADBLUE', 'READ']]}><AdBluePurchasesPage /></ProtectedRoute>} />
        <Route path="/adblue/purchases/new" element={<ProtectedRoute anyOf={[['ADBLUE', 'CREATE']]}><AdBluePurchaseFormPage /></ProtectedRoute>} />
        <Route path="/adblue/purchases/:id/edit" element={<ProtectedRoute anyOf={[['ADBLUE', 'UPDATE']]}><AdBluePurchaseFormPage /></ProtectedRoute>} />
        <Route path="/adblue/fillings" element={<ProtectedRoute anyOf={[['ADBLUE', 'READ']]}><AdBlueFillingsPage /></ProtectedRoute>} />
        <Route path="/adblue/fillings/new" element={<ProtectedRoute anyOf={[['ADBLUE', 'CREATE']]}><AdBlueFillingFormPage /></ProtectedRoute>} />
        <Route path="/adblue/fillings/:id/edit" element={<ProtectedRoute anyOf={[['ADBLUE', 'UPDATE']]}><AdBlueFillingFormPage /></ProtectedRoute>} />
        <Route path="/adblue/reports" element={<ProtectedRoute anyOf={[['ADBLUE', 'READ']]}><AdBlueReportsPage /></ProtectedRoute>} />

        <Route path="/tyres" element={<Navigate to="/tyres/stock" replace />} />
        <Route path="/tyres/stock" element={<ProtectedRoute anyOf={[['TYRE', 'READ']]}><TyreStockPage /></ProtectedRoute>} />
        <Route path="/tyres/purchases" element={<ProtectedRoute anyOf={[['TYRE', 'READ']]}><TyrePurchasesPage /></ProtectedRoute>} />
        <Route path="/tyres/purchases/new" element={<ProtectedRoute anyOf={[['TYRE', 'CREATE']]}><TyrePurchaseFormPage /></ProtectedRoute>} />
        <Route path="/tyres/purchases/:id" element={<ProtectedRoute anyOf={[['TYRE', 'READ']]}><TyrePurchaseDetailPage /></ProtectedRoute>} />
        <Route path="/tyres/fitting" element={<ProtectedRoute anyOf={[['TYRE', 'READ']]}><TyreFittingPage /></ProtectedRoute>} />
        <Route path="/tyres/fitting/new" element={<ProtectedRoute anyOf={[['TYRE', 'CREATE']]}><TyreFitFormPage /></ProtectedRoute>} />
        <Route path="/tyres/reports" element={<ProtectedRoute allOf={[['TYRE', 'READ'], ['REPORTS', 'VIEW']]}><TyreReportsPage /></ProtectedRoute>} />

        <Route path="/batteries" element={<ProtectedRoute anyOf={[['BATTERY', 'READ']]}><BatteriesPage /></ProtectedRoute>} />
        <Route path="/batteries/add" element={<ProtectedRoute anyOf={[['BATTERY', 'CREATE']]}><AddBatteriesPage /></ProtectedRoute>} />
        <Route path="/batteries/history" element={<ProtectedRoute anyOf={[['BATTERY', 'READ']]}><BatteryHistoryPage /></ProtectedRoute>} />
        <Route path="/batteries/:id" element={<ProtectedRoute anyOf={[['BATTERY', 'READ']]}><BatteryDetailPage /></ProtectedRoute>} />

        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
