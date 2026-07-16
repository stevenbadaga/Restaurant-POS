-- CreateEnum
CREATE TYPE "PublicOrderStatus" AS ENUM ('RECEIVED', 'AWAITING_CONFIRMATION', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PublicOrderSource" AS ENUM ('WEBSITE', 'QR_TABLE', 'STAFF_ASSISTED');

-- CreateEnum
CREATE TYPE "PublicPaymentChoice" AS ENUM ('PAY_ON_PICKUP', 'PAY_ON_DELIVERY', 'PAY_AT_CASHIER', 'MANUAL_MOBILE_MONEY_REFERENCE');

-- CreateEnum
CREATE TYPE "DietaryLabel" AS ENUM ('VEGETARIAN', 'VEGAN', 'HALAL', 'GLUTEN_AWARE', 'SPICY', 'CONTAINS_NUTS');

-- CreateEnum
CREATE TYPE "PublicOrderAcceptanceMode" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "PurchaseRequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PurchaseApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierQuotationStatus" AS ENUM ('RECEIVED', 'SELECTED', 'NOT_SELECTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('DRAFT', 'VERIFIED', 'PARTIALLY_MATCHED', 'MATCHED', 'DISPUTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierReturnStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockCountType" AS ENUM ('FULL', 'CYCLE', 'SPOT');

-- CreateEnum
CREATE TYPE "StockCountLineStatus" AS ENUM ('NOT_COUNTED', 'COUNTED', 'RECOUNT_REQUIRED', 'APPROVED', 'POSTED');

-- CreateEnum
CREATE TYPE "PurchasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('MATCHED', 'QUANTITY_VARIANCE', 'PRICE_VARIANCE', 'TAX_VARIANCE', 'UNMATCHED_CHARGE', 'PARTIAL_MATCH');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('UPLOADED', 'VALIDATED', 'READY', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('DINING_AREAS', 'TABLES', 'MENU_CATEGORIES', 'KITCHEN_STATIONS', 'MENU_ITEMS', 'INVENTORY_CATEGORIES', 'STOCK_LOCATIONS', 'INVENTORY_ITEMS', 'SUPPLIERS', 'OPENING_STOCK', 'STAFF', 'CUSTOMERS');

-- CreateEnum
CREATE TYPE "UATStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'PASSED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CancellationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CASUAL', 'CONTRACT', 'INTERN', 'TEMPORARY', 'OTHER');

-- CreateEnum
CREATE TYPE "PayBasis" AS ENUM ('MONTHLY_SALARY', 'HOURLY', 'DAILY', 'FIXED_PERIOD', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'SEMIMONTHLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "LeaveTypeCode" AS ENUM ('ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'PATERNITY', 'COMPASSIONATE', 'STUDY', 'TIME_OFF_IN_LIEU', 'OTHER');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'CANCELLED', 'TAKEN');

-- CreateEnum
CREATE TYPE "LeaveLedgerTransactionType" AS ENUM ('OPENING_BALANCE', 'ACCRUAL', 'MANUAL_ADJUSTMENT_IN', 'MANUAL_ADJUSTMENT_OUT', 'LEAVE_RESERVED', 'LEAVE_TAKEN', 'LEAVE_RELEASED', 'EXPIRY', 'CARRY_FORWARD');

-- CreateEnum
CREATE TYPE "LeaveUnit" AS ENUM ('DAYS', 'HOURS');

-- CreateEnum
CREATE TYPE "LeaveAccrualFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY', 'PAYROLL_PERIOD', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'FINALIZED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollEmployeeLineStatus" AS ENUM ('DRAFT', 'CALCULATED', 'REVIEW_REQUIRED', 'APPROVED', 'FINALIZED', 'PARTIALLY_PAID', 'PAID', 'VOIDED');

-- CreateEnum
CREATE TYPE "PayrollComponentType" AS ENUM ('BASE_EARNING', 'OVERTIME', 'ALLOWANCE', 'BONUS', 'TIP', 'SERVICE_CHARGE', 'EMPLOYEE_DEDUCTION', 'EMPLOYER_CONTRIBUTION', 'ADVANCE_REPAYMENT', 'UNPAID_LEAVE_DEDUCTION', 'INFORMATIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PayrollCalculationMethod" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE_OF_BASE', 'PERCENTAGE_OF_GROSS', 'PER_HOUR', 'PER_DAY', 'MANUAL', 'FORMULA');

-- CreateEnum
CREATE TYPE "PayrollApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollDisbursementStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollPaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffAdvanceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'DISBURSED', 'PARTIALLY_REPAID', 'REPAID', 'REJECTED', 'CANCELLED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "StaffAdvanceRepaymentMethod" AS ENUM ('PAYROLL_DEDUCTION', 'CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'OTHER');

-- CreateEnum
CREATE TYPE "TipStatus" AS ENUM ('RECORDED', 'AVAILABLE_FOR_DISTRIBUTION', 'ALLOCATED', 'PAID', 'REVERSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TipAllocationMethod" AS ENUM ('DIRECT_EMPLOYEE', 'EQUAL_SHARE', 'HOURS_WORKED', 'ROLE_WEIGHTED', 'CUSTOM_PERCENTAGE', 'CUSTOM_AMOUNT');

-- CreateEnum
CREATE TYPE "ServiceChargeDistributionMethod" AS ENUM ('EQUAL_SHARE', 'HOURS_WORKED', 'ROLE_WEIGHTED', 'CUSTOM_PERCENTAGE', 'CUSTOM_AMOUNT');

-- CreateEnum
CREATE TYPE "DistributionPoolStatus" AS ENUM ('DRAFT', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'POSTED_TO_PAYROLL', 'PAID', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('ISSUED', 'VOIDED', 'REPLACED');

-- CreateEnum
CREATE TYPE "AdvanceRepaymentStatus" AS ENUM ('POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayrollLineItemSourceType" AS ENUM ('COMPENSATION_PROFILE', 'ATTENDANCE', 'OVERTIME', 'LEAVE', 'RECURRING_COMPONENT', 'MANUAL_ADJUSTMENT', 'STAFF_ADVANCE', 'TIP_POOL', 'SERVICE_CHARGE_POOL', 'OTHER');

-- CreateEnum
CREATE TYPE "DistributionAllocationStatus" AS ENUM ('CALCULATED', 'APPROVED', 'POSTED_TO_PAYROLL', 'PAID', 'REVERSED');

-- CreateEnum
CREATE TYPE "StatutoryCalculationMode" AS ENUM ('DISABLED', 'MANUAL_CONFIGURATION', 'EXTERNAL_SYSTEM');

-- CreateEnum
CREATE TYPE "OvertimeApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'PICKUP';

-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN     "allergenInformation" TEXT,
ADD COLUMN     "dietaryLabels" TEXT,
ADD COLUMN     "isFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isPubliclyVisible" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "publicImageUrl" TEXT,
ADD COLUMN     "publicSortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedById" TEXT,
ADD COLUMN     "customerEmailSnapshot" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryAddressId" TEXT,
ADD COLUMN     "deliveryAddressSnapshot" JSONB,
ADD COLUMN     "deliveryAssignedToId" TEXT,
ADD COLUMN     "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryInstructions" TEXT,
ADD COLUMN     "deliveryZoneId" TEXT,
ADD COLUMN     "dispatchedAt" TIMESTAMP(3),
ADD COLUMN     "manualPaymentProvider" TEXT,
ADD COLUMN     "manualPaymentReference" TEXT,
ADD COLUMN     "pickupTimeRequested" TIMESTAMP(3),
ADD COLUMN     "publicAccessTokenHash" TEXT,
ADD COLUMN     "publicOrderNotes" TEXT,
ADD COLUMN     "publicOrderSource" "PublicOrderSource",
ADD COLUMN     "publicOrderStatus" "PublicOrderStatus",
ADD COLUMN     "publicPaymentChoice" "PublicPaymentChoice",
ADD COLUMN     "publicReference" TEXT,
ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT;

-- AlterTable
ALTER TABLE "Promotion" ADD COLUMN     "publicBannerImageUrl" TEXT,
ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "publiclyVisible" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Restaurant" ADD COLUMN     "publicSlug" TEXT;

-- AlterTable
ALTER TABLE "RestaurantSettings" ADD COLUMN     "allowGuestCheckout" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryPreparationMinutes" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "dineInQrOrderingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pickupPreparationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "publicAddress" TEXT,
ADD COLUMN     "publicContactEmail" TEXT,
ADD COLUMN     "publicContactPhone" TEXT,
ADD COLUMN     "publicFacebookUrl" TEXT,
ADD COLUMN     "publicHeroImageUrl" TEXT,
ADD COLUMN     "publicInstagramUrl" TEXT,
ADD COLUMN     "publicLogoUrl" TEXT,
ADD COLUMN     "publicMapUrl" TEXT,
ADD COLUMN     "publicMaximumActiveOrders" INTEGER,
ADD COLUMN     "publicMaximumAdvanceOrderDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "publicMaximumOrdersPerTimeSlot" INTEGER,
ADD COLUMN     "publicMenuShowAllergenNotice" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicMenuShowAvailability" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicMenuShowPreparationTime" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicMenuShowPrices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicMinimumOrderAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "publicOrderAcceptanceMode" "PublicOrderAcceptanceMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "publicOrderAutoAccept" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicOrderNotesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "publicOrderSlotMinutes" INTEGER NOT NULL DEFAULT 15,
ADD COLUMN     "publicOrderingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicPauseOrdering" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicPauseOrderingReason" TEXT,
ADD COLUMN     "publicReservationAllowTableSelection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicReservationAutoConfirm" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicReservationMaximumDaysAhead" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "publicReservationMaximumPartySize" INTEGER,
ADD COLUMN     "publicReservationMinimumLeadMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "publicReservationRequireDiningArea" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicReservationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicRestaurantDescription" TEXT,
ADD COLUMN     "publicWebsiteEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicWhatsAppNumber" TEXT,
ADD COLUMN     "publicXUrl" TEXT,
ADD COLUMN     "qrOrderAllowsAdditionalItems" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qrOrderRequiresCustomerName" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qrOrderRequiresPhone" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qrOrderRequiresWaiterApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "qrTableOrderingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireEmailForPublicOrder" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requirePhoneForPublicOrder" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "importType" "ImportType" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'UPLOADED',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "invalidRows" INTEGER NOT NULL DEFAULT 0,
    "warningRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "updatedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "requestedById" TEXT NOT NULL,
    "previewData" JSONB,
    "errorSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UATScenario" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "scenarioKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "status" "UATStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "assignedToId" TEXT,
    "testedById" TEXT,
    "testedAt" TIMESTAMP(3),
    "notes" TEXT,
    "evidenceReference" TEXT,
    "issueReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UATScenario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOpeningHour" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "supportsPickup" BOOLEAN NOT NULL DEFAULT true,
    "supportsDelivery" BOOLEAN NOT NULL DEFAULT false,
    "supportsReservations" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOpeningHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpeningHourPeriod" (
    "id" TEXT NOT NULL,
    "openingHourId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "openTime" TEXT NOT NULL,
    "closeTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningHourPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantSpecialHour" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "openTime" TEXT,
    "closeTime" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantSpecialHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "minimumOrderAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "estimatedDeliveryMinutes" INTEGER NOT NULL DEFAULT 30,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "deliveryZoneId" TEXT,
    "label" TEXT,
    "recipientName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "neighbourhood" TEXT,
    "city" TEXT NOT NULL,
    "landmark" TEXT,
    "deliveryInstructions" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableQrToken" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rotatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "TableQrToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicOrderCancellationRequest" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "CancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicOrderCancellationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicOrderIdempotencyKey" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicOrderIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEmploymentProfile" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCodeSnapshot" TEXT NOT NULL,
    "employmentType" "EmploymentType" NOT NULL,
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "jobTitle" TEXT,
    "department" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "contractStartDate" TIMESTAMP(3),
    "contractEndDate" TIMESTAMP(3),
    "probationEndDate" TIMESTAMP(3),
    "terminationDate" TIMESTAMP(3),
    "terminationReason" TEXT,
    "standardHoursPerWeek" DOUBLE PRECISION,
    "standardDaysPerWeek" INTEGER,
    "defaultPayFrequency" "PayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "primaryPayBasis" "PayBasis" NOT NULL DEFAULT 'MONTHLY_SALARY',
    "payrollEligible" BOOLEAN NOT NULL DEFAULT true,
    "leaveEligible" BOOLEAN NOT NULL DEFAULT true,
    "overtimeEligible" BOOLEAN NOT NULL DEFAULT true,
    "tipEligible" BOOLEAN NOT NULL DEFAULT true,
    "serviceChargeEligible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEmploymentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCompensationProfile" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employmentProfileId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "payBasis" "PayBasis" NOT NULL,
    "payFrequency" "PayFrequency" NOT NULL,
    "baseSalary" DECIMAL(65,30),
    "hourlyRate" DECIMAL(65,30),
    "dailyRate" DECIMAL(65,30),
    "fixedPeriodAmount" DECIMAL(65,30),
    "overtimeRateMultiplier" DECIMAL(65,30) NOT NULL DEFAULT 1.5,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "standardHoursPerDay" DECIMAL(65,30),
    "standardWorkingDaysPerPeriod" INTEGER,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCompensationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveType" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leaveTypeCode" "LeaveTypeCode" NOT NULL,
    "unit" "LeaveUnit" NOT NULL DEFAULT 'DAYS',
    "isPaid" BOOLEAN NOT NULL DEFAULT true,
    "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "allowsNegativeBalance" BOOLEAN NOT NULL DEFAULT false,
    "maximumNegativeBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minimumNoticeDays" INTEGER NOT NULL DEFAULT 0,
    "maximumConsecutiveUnits" DECIMAL(65,30),
    "allowHalfDay" BOOLEAN NOT NULL DEFAULT true,
    "allowHourlyRequest" BOOLEAN NOT NULL DEFAULT false,
    "colorKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeavePolicy" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "employmentType" "EmploymentType",
    "annualEntitlement" DECIMAL(65,30) NOT NULL,
    "accrualEnabled" BOOLEAN NOT NULL DEFAULT false,
    "accrualFrequency" "LeaveAccrualFrequency",
    "accrualAmount" DECIMAL(65,30),
    "carryForwardEnabled" BOOLEAN NOT NULL DEFAULT false,
    "maximumCarryForward" DECIMAL(65,30),
    "expiryMonths" INTEGER,
    "waitingPeriodDays" INTEGER NOT NULL DEFAULT 0,
    "prorateForNewEmployee" BOOLEAN NOT NULL DEFAULT true,
    "prorateForTerminatedEmployee" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeLeaveBalance" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "balanceYear" INTEGER NOT NULL,
    "openingBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "accrued" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "used" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expired" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "adjusted" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "availableBalance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeLeaveBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveLedgerTransaction" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "leaveBalanceId" TEXT NOT NULL,
    "transactionType" "LeaveLedgerTransactionType" NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "balanceBefore" DECIMAL(65,30) NOT NULL,
    "balanceAfter" DECIMAL(65,30) NOT NULL,
    "leaveRequestId" TEXT,
    "reason" TEXT,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "parentTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveLedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "leaveRequestNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "startHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "endHalfDay" BOOLEAN NOT NULL DEFAULT false,
    "startTime" TEXT,
    "endTime" TEXT,
    "requestedQuantity" DECIMAL(65,30) NOT NULL,
    "approvedQuantity" DECIMAL(65,30),
    "reason" TEXT NOT NULL,
    "employeeNotes" TEXT,
    "managerNotes" TEXT,
    "attachmentReference" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApproval" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "approvedQuantity" DECIMAL(65,30),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OvertimeApproval" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftAssignmentId" TEXT,
    "overtimeMinutes" INTEGER NOT NULL,
    "status" "OvertimeApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OvertimeApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "periodNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3),
    "payFrequency" "PayFrequency" NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "notes" TEXT,
    "openedAt" TIMESTAMP(3),
    "openedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollComponentDefinition" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "componentType" "PayrollComponentType" NOT NULL,
    "calculationMethod" "PayrollCalculationMethod" NOT NULL,
    "defaultAmount" DECIMAL(65,30),
    "defaultPercentage" DECIMAL(65,30),
    "defaultRate" DECIMAL(65,30),
    "taxable" BOOLEAN NOT NULL DEFAULT false,
    "pensionable" BOOLEAN NOT NULL DEFAULT false,
    "affectsGrossPay" BOOLEAN NOT NULL DEFAULT true,
    "affectsNetPay" BOOLEAN NOT NULL DEFAULT true,
    "employerOnly" BOOLEAN NOT NULL DEFAULT false,
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "displayOnPayslip" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollComponentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRecurringPayrollComponent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payrollComponentDefinitionId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "amount" DECIMAL(65,30),
    "percentage" DECIMAL(65,30),
    "rate" DECIMAL(65,30),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRecurringPayrollComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "payrollRunNumber" TEXT NOT NULL,
    "payrollPeriodId" TEXT NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "employeeCount" INTEGER NOT NULL DEFAULT 0,
    "totalBasePay" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalOvertime" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAllowances" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalBonuses" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalTips" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalServiceCharge" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalGrossEarnings" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalEmployeeDeductions" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalEmployerContributions" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAdvanceRepayments" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalNetPay" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmountDue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "calculatedAt" TIMESTAMP(3),
    "calculatedById" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancellationReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollEmployeeLine" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCodeSnapshot" TEXT NOT NULL,
    "employeeNameSnapshot" TEXT NOT NULL,
    "jobTitleSnapshot" TEXT,
    "employmentTypeSnapshot" TEXT NOT NULL,
    "payBasisSnapshot" TEXT NOT NULL,
    "compensationEffectiveDate" TIMESTAMP(3),
    "baseRateSnapshot" DECIMAL(65,30),
    "standardHours" DECIMAL(65,30),
    "workedHours" DECIMAL(65,30),
    "paidLeaveHours" DECIMAL(65,30),
    "unpaidLeaveHours" DECIMAL(65,30),
    "overtimeHours" DECIMAL(65,30),
    "basePay" DECIMAL(65,30),
    "overtimePay" DECIMAL(65,30),
    "allowanceTotal" DECIMAL(65,30),
    "bonusTotal" DECIMAL(65,30),
    "tipTotal" DECIMAL(65,30),
    "serviceChargeTotal" DECIMAL(65,30),
    "grossEarnings" DECIMAL(65,30),
    "employeeDeductionTotal" DECIMAL(65,30),
    "employerContributionTotal" DECIMAL(65,30),
    "advanceRepaymentTotal" DECIMAL(65,30),
    "netPay" DECIMAL(65,30),
    "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "amountDue" DECIMAL(65,30),
    "status" "PayrollEmployeeLineStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewReason" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollEmployeeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollLineItem" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "payrollEmployeeLineId" TEXT NOT NULL,
    "payrollComponentDefinitionId" TEXT,
    "componentCodeSnapshot" TEXT NOT NULL,
    "componentNameSnapshot" TEXT NOT NULL,
    "componentType" "PayrollComponentType" NOT NULL,
    "calculationMethodSnapshot" TEXT NOT NULL,
    "quantity" DECIMAL(65,30),
    "rate" DECIMAL(65,30),
    "percentage" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL,
    "sourceType" "PayrollLineItemSourceType" NOT NULL,
    "sourceId" TEXT,
    "description" TEXT,
    "isEmployerOnly" BOOLEAN NOT NULL DEFAULT false,
    "displayOnPayslip" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollApproval" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "status" "PayrollApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollDisbursement" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "payrollDisbursementNumber" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollEmployeeLineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "paymentMethod" "PayrollPaymentMethod" NOT NULL,
    "status" "PayrollDisbursementStatus" NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(65,30) NOT NULL,
    "referenceNumber" TEXT,
    "providerName" TEXT,
    "cashierSessionId" TEXT,
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "postedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDisbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "payslipNumber" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollEmployeeLineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'ISSUED',
    "employeeSnapshot" JSONB NOT NULL,
    "earningsSnapshot" JSONB NOT NULL,
    "deductionsSnapshot" JSONB NOT NULL,
    "employerContributionsSnapshot" JSONB,
    "summarySnapshot" JSONB NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "replacedByPayslipId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAdvance" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "advanceNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestDate" TIMESTAMP(3) NOT NULL,
    "requestedAmount" DECIMAL(65,30) NOT NULL,
    "approvedAmount" DECIMAL(65,30),
    "disbursedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "repaidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'RWF',
    "status" "StaffAdvanceStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT NOT NULL,
    "requestedRepaymentAmountPerPeriod" DECIMAL(65,30),
    "approvedRepaymentAmountPerPeriod" DECIMAL(65,30),
    "plannedStartPeriodId" TEXT,
    "requestedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectionReason" TEXT,
    "disbursedAt" TIMESTAMP(3),
    "disbursedById" TEXT,
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "cashierSessionId" TEXT,
    "writtenOffAt" TIMESTAMP(3),
    "writtenOffById" TEXT,
    "writeOffReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAdvance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAdvanceRepayment" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "staffAdvanceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "repaymentDate" TIMESTAMP(3) NOT NULL,
    "repaymentMethod" "StaffAdvanceRepaymentMethod" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "payrollEmployeeLineId" TEXT,
    "cashierSessionId" TEXT,
    "referenceNumber" TEXT,
    "status" "AdvanceRepaymentStatus" NOT NULL DEFAULT 'POSTED',
    "recordedById" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAdvanceRepayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerTip" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tipNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentId" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "status" "TipStatus" NOT NULL DEFAULT 'RECORDED',
    "directRecipientUserId" TEXT,
    "tipPoolId" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversalReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerTip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipPool" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tipPoolNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "allocationMethod" "TipAllocationMethod" NOT NULL,
    "status" "DistributionPoolStatus" NOT NULL DEFAULT 'DRAFT',
    "totalTipAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "distributableAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "undistributedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "includedPaymentMethods" JSONB,
    "eligibleRoles" JSONB,
    "notes" TEXT,
    "calculatedAt" TIMESTAMP(3),
    "calculatedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "postedToPayrollRunId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TipPoolAllocation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tipPoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allocationBasis" TEXT NOT NULL,
    "basisValue" DECIMAL(65,30),
    "allocationPercentage" DECIMAL(65,30),
    "allocatedAmount" DECIMAL(65,30) NOT NULL,
    "payrollEmployeeLineId" TEXT,
    "status" "DistributionAllocationStatus" NOT NULL DEFAULT 'CALCULATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TipPoolAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceChargePool" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "serviceChargePoolNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "distributionMethod" "ServiceChargeDistributionMethod" NOT NULL,
    "status" "DistributionPoolStatus" NOT NULL DEFAULT 'DRAFT',
    "totalServiceChargeCollected" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "restaurantRetainedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "distributableAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "undistributedAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "eligibleRoles" JSONB,
    "notes" TEXT,
    "calculationBasis" TEXT NOT NULL DEFAULT 'CASH_COLLECTED',
    "calculatedAt" TIMESTAMP(3),
    "calculatedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "postedToPayrollRunId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceChargePool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceChargeAllocation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "serviceChargePoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "allocationBasis" TEXT NOT NULL,
    "basisValue" DECIMAL(65,30),
    "allocationPercentage" DECIMAL(65,30),
    "allocatedAmount" DECIMAL(65,30) NOT NULL,
    "payrollEmployeeLineId" TEXT,
    "status" "DistributionAllocationStatus" NOT NULL DEFAULT 'CALCULATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceChargeAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollSettings" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "payrollEnabled" BOOLEAN NOT NULL DEFAULT false,
    "defaultPayFrequency" "PayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "payrollCurrency" TEXT NOT NULL DEFAULT 'RWF',
    "payrollPeriodStartDay" INTEGER NOT NULL DEFAULT 1,
    "requirePayrollApproval" BOOLEAN NOT NULL DEFAULT true,
    "preventPayrollSelfApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireEmployeeLineApproval" BOOLEAN NOT NULL DEFAULT false,
    "attendanceRequiredForHourlyPayroll" BOOLEAN NOT NULL DEFAULT true,
    "approvedAttendanceOnly" BOOLEAN NOT NULL DEFAULT true,
    "overtimeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "overtimeRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "overtimeRoundingMinutes" INTEGER NOT NULL DEFAULT 15,
    "allowNegativeNetPay" BOOLEAN NOT NULL DEFAULT false,
    "cashPayrollRequiresCashierSession" BOOLEAN NOT NULL DEFAULT true,
    "leaveAccrualEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tipsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tipPoolingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serviceChargeDistributionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "serviceChargeEmployeeDistributionPercentage" DECIMAL(65,30) DEFAULT 0,
    "defaultTipAllocationMethod" "TipAllocationMethod",
    "defaultServiceChargeDistributionMethod" "ServiceChargeDistributionMethod",
    "advanceRepaymentEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maximumAdvancePercentageOfBasePay" DECIMAL(65,30) NOT NULL DEFAULT 50,
    "payslipEnabled" BOOLEAN NOT NULL DEFAULT true,
    "payslipPaperSize" TEXT NOT NULL DEFAULT 'A4',
    "payslipShowEmployerContributions" BOOLEAN NOT NULL DEFAULT true,
    "statutoryCalculationMode" "StatutoryCalculationMode" NOT NULL DEFAULT 'MANUAL_CONFIGURATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_userLeaveApproval" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_userLeaveApproval_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_userPayrollRun" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_userPayrollRun_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_userPayrollApproval" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_userPayrollApproval_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_userCustomerTip" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_userCustomerTip_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_userTipPool" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_userTipPool_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_userServiceChargePool" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_userServiceChargePool_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "ImportJob_restaurantId_idx" ON "ImportJob"("restaurantId");

-- CreateIndex
CREATE INDEX "ImportJob_importType_idx" ON "ImportJob"("importType");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- CreateIndex
CREATE INDEX "UATScenario_restaurantId_idx" ON "UATScenario"("restaurantId");

-- CreateIndex
CREATE INDEX "UATScenario_module_idx" ON "UATScenario"("module");

-- CreateIndex
CREATE INDEX "UATScenario_roleName_idx" ON "UATScenario"("roleName");

-- CreateIndex
CREATE INDEX "UATScenario_status_idx" ON "UATScenario"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UATScenario_restaurantId_scenarioKey_key" ON "UATScenario"("restaurantId", "scenarioKey");

-- CreateIndex
CREATE INDEX "RestaurantOpeningHour_restaurantId_idx" ON "RestaurantOpeningHour"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantOpeningHour_restaurantId_dayOfWeek_key" ON "RestaurantOpeningHour"("restaurantId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "OpeningHourPeriod_openingHourId_idx" ON "OpeningHourPeriod"("openingHourId");

-- CreateIndex
CREATE INDEX "OpeningHourPeriod_restaurantId_idx" ON "OpeningHourPeriod"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantSpecialHour_restaurantId_idx" ON "RestaurantSpecialHour"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantSpecialHour_restaurantId_date_key" ON "RestaurantSpecialHour"("restaurantId", "date");

-- CreateIndex
CREATE INDEX "DeliveryZone_restaurantId_idx" ON "DeliveryZone"("restaurantId");

-- CreateIndex
CREATE INDEX "DeliveryZone_restaurantId_isActive_idx" ON "DeliveryZone"("restaurantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_restaurantId_name_key" ON "DeliveryZone"("restaurantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_restaurantId_code_key" ON "DeliveryZone"("restaurantId", "code");

-- CreateIndex
CREATE INDEX "CustomerAddress_restaurantId_idx" ON "CustomerAddress"("restaurantId");

-- CreateIndex
CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");

-- CreateIndex
CREATE INDEX "CustomerAddress_deliveryZoneId_idx" ON "CustomerAddress"("deliveryZoneId");

-- CreateIndex
CREATE INDEX "CustomerAddress_isActive_idx" ON "CustomerAddress"("isActive");

-- CreateIndex
CREATE INDEX "TableQrToken_restaurantId_idx" ON "TableQrToken"("restaurantId");

-- CreateIndex
CREATE INDEX "TableQrToken_tableId_idx" ON "TableQrToken"("tableId");

-- CreateIndex
CREATE INDEX "TableQrToken_isActive_idx" ON "TableQrToken"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TableQrToken_restaurantId_tokenHash_key" ON "TableQrToken"("restaurantId", "tokenHash");

-- CreateIndex
CREATE INDEX "PublicOrderCancellationRequest_restaurantId_idx" ON "PublicOrderCancellationRequest"("restaurantId");

-- CreateIndex
CREATE INDEX "PublicOrderCancellationRequest_orderId_idx" ON "PublicOrderCancellationRequest"("orderId");

-- CreateIndex
CREATE INDEX "PublicOrderCancellationRequest_status_idx" ON "PublicOrderCancellationRequest"("status");

-- CreateIndex
CREATE INDEX "PublicOrderIdempotencyKey_restaurantId_idx" ON "PublicOrderIdempotencyKey"("restaurantId");

-- CreateIndex
CREATE INDEX "PublicOrderIdempotencyKey_expiresAt_idx" ON "PublicOrderIdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicOrderIdempotencyKey_restaurantId_idempotencyKey_key" ON "PublicOrderIdempotencyKey"("restaurantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "EmployeeEmploymentProfile_restaurantId_idx" ON "EmployeeEmploymentProfile"("restaurantId");

-- CreateIndex
CREATE INDEX "EmployeeEmploymentProfile_employmentStatus_idx" ON "EmployeeEmploymentProfile"("employmentStatus");

-- CreateIndex
CREATE INDEX "EmployeeEmploymentProfile_employmentType_idx" ON "EmployeeEmploymentProfile"("employmentType");

-- CreateIndex
CREATE INDEX "EmployeeEmploymentProfile_payrollEligible_idx" ON "EmployeeEmploymentProfile"("payrollEligible");

-- CreateIndex
CREATE INDEX "EmployeeEmploymentProfile_hireDate_idx" ON "EmployeeEmploymentProfile"("hireDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeEmploymentProfile_restaurantId_userId_key" ON "EmployeeEmploymentProfile"("restaurantId", "userId");

-- CreateIndex
CREATE INDEX "EmployeeCompensationProfile_userId_idx" ON "EmployeeCompensationProfile"("userId");

-- CreateIndex
CREATE INDEX "EmployeeCompensationProfile_effectiveFrom_idx" ON "EmployeeCompensationProfile"("effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeCompensationProfile_effectiveTo_idx" ON "EmployeeCompensationProfile"("effectiveTo");

-- CreateIndex
CREATE INDEX "EmployeeCompensationProfile_isActive_idx" ON "EmployeeCompensationProfile"("isActive");

-- CreateIndex
CREATE INDEX "LeaveType_restaurantId_idx" ON "LeaveType"("restaurantId");

-- CreateIndex
CREATE INDEX "LeaveType_isActive_idx" ON "LeaveType"("isActive");

-- CreateIndex
CREATE INDEX "LeaveType_leaveTypeCode_idx" ON "LeaveType"("leaveTypeCode");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_restaurantId_code_key" ON "LeaveType"("restaurantId", "code");

-- CreateIndex
CREATE INDEX "LeavePolicy_leaveTypeId_idx" ON "LeavePolicy"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeavePolicy_employmentType_idx" ON "LeavePolicy"("employmentType");

-- CreateIndex
CREATE INDEX "LeavePolicy_effectiveFrom_idx" ON "LeavePolicy"("effectiveFrom");

-- CreateIndex
CREATE INDEX "LeavePolicy_isActive_idx" ON "LeavePolicy"("isActive");

-- CreateIndex
CREATE INDEX "EmployeeLeaveBalance_userId_idx" ON "EmployeeLeaveBalance"("userId");

-- CreateIndex
CREATE INDEX "EmployeeLeaveBalance_leaveTypeId_idx" ON "EmployeeLeaveBalance"("leaveTypeId");

-- CreateIndex
CREATE INDEX "EmployeeLeaveBalance_balanceYear_idx" ON "EmployeeLeaveBalance"("balanceYear");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeLeaveBalance_restaurantId_userId_leaveTypeId_balanc_key" ON "EmployeeLeaveBalance"("restaurantId", "userId", "leaveTypeId", "balanceYear");

-- CreateIndex
CREATE INDEX "LeaveLedgerTransaction_userId_idx" ON "LeaveLedgerTransaction"("userId");

-- CreateIndex
CREATE INDEX "LeaveLedgerTransaction_leaveTypeId_idx" ON "LeaveLedgerTransaction"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveLedgerTransaction_leaveRequestId_idx" ON "LeaveLedgerTransaction"("leaveRequestId");

-- CreateIndex
CREATE INDEX "LeaveLedgerTransaction_effectiveDate_idx" ON "LeaveLedgerTransaction"("effectiveDate");

-- CreateIndex
CREATE INDEX "LeaveLedgerTransaction_transactionType_idx" ON "LeaveLedgerTransaction"("transactionType");

-- CreateIndex
CREATE INDEX "LeaveRequest_userId_idx" ON "LeaveRequest"("userId");

-- CreateIndex
CREATE INDEX "LeaveRequest_leaveTypeId_idx" ON "LeaveRequest"("leaveTypeId");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_idx" ON "LeaveRequest"("status");

-- CreateIndex
CREATE INDEX "LeaveRequest_startDate_idx" ON "LeaveRequest"("startDate");

-- CreateIndex
CREATE INDEX "LeaveRequest_endDate_idx" ON "LeaveRequest"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_restaurantId_leaveRequestNumber_key" ON "LeaveRequest"("restaurantId", "leaveRequestNumber");

-- CreateIndex
CREATE INDEX "LeaveApproval_leaveRequestId_idx" ON "LeaveApproval"("leaveRequestId");

-- CreateIndex
CREATE INDEX "LeaveApproval_status_idx" ON "LeaveApproval"("status");

-- CreateIndex
CREATE INDEX "LeaveApproval_reviewedById_idx" ON "LeaveApproval"("reviewedById");

-- CreateIndex
CREATE INDEX "OvertimeApproval_userId_idx" ON "OvertimeApproval"("userId");

-- CreateIndex
CREATE INDEX "OvertimeApproval_status_idx" ON "OvertimeApproval"("status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_startDate_idx" ON "PayrollPeriod"("startDate");

-- CreateIndex
CREATE INDEX "PayrollPeriod_endDate_idx" ON "PayrollPeriod"("endDate");

-- CreateIndex
CREATE INDEX "PayrollPeriod_status_idx" ON "PayrollPeriod"("status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_payFrequency_idx" ON "PayrollPeriod"("payFrequency");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_restaurantId_periodNumber_key" ON "PayrollPeriod"("restaurantId", "periodNumber");

-- CreateIndex
CREATE INDEX "PayrollComponentDefinition_restaurantId_idx" ON "PayrollComponentDefinition"("restaurantId");

-- CreateIndex
CREATE INDEX "PayrollComponentDefinition_componentType_idx" ON "PayrollComponentDefinition"("componentType");

-- CreateIndex
CREATE INDEX "PayrollComponentDefinition_isActive_idx" ON "PayrollComponentDefinition"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollComponentDefinition_restaurantId_code_key" ON "PayrollComponentDefinition"("restaurantId", "code");

-- CreateIndex
CREATE INDEX "EmployeeRecurringPayrollComponent_userId_idx" ON "EmployeeRecurringPayrollComponent"("userId");

-- CreateIndex
CREATE INDEX "EmployeeRecurringPayrollComponent_payrollComponentDefinitio_idx" ON "EmployeeRecurringPayrollComponent"("payrollComponentDefinitionId");

-- CreateIndex
CREATE INDEX "EmployeeRecurringPayrollComponent_effectiveFrom_idx" ON "EmployeeRecurringPayrollComponent"("effectiveFrom");

-- CreateIndex
CREATE INDEX "EmployeeRecurringPayrollComponent_isActive_idx" ON "EmployeeRecurringPayrollComponent"("isActive");

-- CreateIndex
CREATE INDEX "PayrollRun_payrollPeriodId_idx" ON "PayrollRun"("payrollPeriodId");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- CreateIndex
CREATE INDEX "PayrollRun_createdAt_idx" ON "PayrollRun"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_restaurantId_payrollRunNumber_key" ON "PayrollRun"("restaurantId", "payrollRunNumber");

-- CreateIndex
CREATE INDEX "PayrollEmployeeLine_payrollRunId_idx" ON "PayrollEmployeeLine"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollEmployeeLine_userId_idx" ON "PayrollEmployeeLine"("userId");

-- CreateIndex
CREATE INDEX "PayrollEmployeeLine_status_idx" ON "PayrollEmployeeLine"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollEmployeeLine_payrollRunId_userId_key" ON "PayrollEmployeeLine"("payrollRunId", "userId");

-- CreateIndex
CREATE INDEX "PayrollLineItem_payrollEmployeeLineId_idx" ON "PayrollLineItem"("payrollEmployeeLineId");

-- CreateIndex
CREATE INDEX "PayrollLineItem_componentType_idx" ON "PayrollLineItem"("componentType");

-- CreateIndex
CREATE INDEX "PayrollApproval_payrollRunId_idx" ON "PayrollApproval"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollApproval_status_idx" ON "PayrollApproval"("status");

-- CreateIndex
CREATE INDEX "PayrollDisbursement_payrollRunId_idx" ON "PayrollDisbursement"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollDisbursement_payrollEmployeeLineId_idx" ON "PayrollDisbursement"("payrollEmployeeLineId");

-- CreateIndex
CREATE INDEX "PayrollDisbursement_userId_idx" ON "PayrollDisbursement"("userId");

-- CreateIndex
CREATE INDEX "PayrollDisbursement_status_idx" ON "PayrollDisbursement"("status");

-- CreateIndex
CREATE INDEX "PayrollDisbursement_paymentDate_idx" ON "PayrollDisbursement"("paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollDisbursement_restaurantId_payrollDisbursementNumber_key" ON "PayrollDisbursement"("restaurantId", "payrollDisbursementNumber");

-- CreateIndex
CREATE INDEX "Payslip_payrollRunId_idx" ON "Payslip"("payrollRunId");

-- CreateIndex
CREATE INDEX "Payslip_userId_idx" ON "Payslip"("userId");

-- CreateIndex
CREATE INDEX "Payslip_status_idx" ON "Payslip"("status");

-- CreateIndex
CREATE INDEX "Payslip_issuedAt_idx" ON "Payslip"("issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_restaurantId_payslipNumber_key" ON "Payslip"("restaurantId", "payslipNumber");

-- CreateIndex
CREATE INDEX "StaffAdvance_userId_idx" ON "StaffAdvance"("userId");

-- CreateIndex
CREATE INDEX "StaffAdvance_status_idx" ON "StaffAdvance"("status");

-- CreateIndex
CREATE INDEX "StaffAdvance_requestDate_idx" ON "StaffAdvance"("requestDate");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAdvance_restaurantId_advanceNumber_key" ON "StaffAdvance"("restaurantId", "advanceNumber");

-- CreateIndex
CREATE INDEX "StaffAdvanceRepayment_staffAdvanceId_idx" ON "StaffAdvanceRepayment"("staffAdvanceId");

-- CreateIndex
CREATE INDEX "StaffAdvanceRepayment_userId_idx" ON "StaffAdvanceRepayment"("userId");

-- CreateIndex
CREATE INDEX "StaffAdvanceRepayment_payrollEmployeeLineId_idx" ON "StaffAdvanceRepayment"("payrollEmployeeLineId");

-- CreateIndex
CREATE INDEX "StaffAdvanceRepayment_repaymentDate_idx" ON "StaffAdvanceRepayment"("repaymentDate");

-- CreateIndex
CREATE INDEX "CustomerTip_orderId_idx" ON "CustomerTip"("orderId");

-- CreateIndex
CREATE INDEX "CustomerTip_paymentId_idx" ON "CustomerTip"("paymentId");

-- CreateIndex
CREATE INDEX "CustomerTip_directRecipientUserId_idx" ON "CustomerTip"("directRecipientUserId");

-- CreateIndex
CREATE INDEX "CustomerTip_status_idx" ON "CustomerTip"("status");

-- CreateIndex
CREATE INDEX "CustomerTip_recordedAt_idx" ON "CustomerTip"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerTip_restaurantId_tipNumber_key" ON "CustomerTip"("restaurantId", "tipNumber");

-- CreateIndex
CREATE INDEX "TipPool_startDate_idx" ON "TipPool"("startDate");

-- CreateIndex
CREATE INDEX "TipPool_endDate_idx" ON "TipPool"("endDate");

-- CreateIndex
CREATE INDEX "TipPool_status_idx" ON "TipPool"("status");

-- CreateIndex
CREATE INDEX "TipPool_postedToPayrollRunId_idx" ON "TipPool"("postedToPayrollRunId");

-- CreateIndex
CREATE UNIQUE INDEX "TipPool_restaurantId_tipPoolNumber_key" ON "TipPool"("restaurantId", "tipPoolNumber");

-- CreateIndex
CREATE INDEX "TipPoolAllocation_tipPoolId_idx" ON "TipPoolAllocation"("tipPoolId");

-- CreateIndex
CREATE INDEX "TipPoolAllocation_userId_idx" ON "TipPoolAllocation"("userId");

-- CreateIndex
CREATE INDEX "TipPoolAllocation_status_idx" ON "TipPoolAllocation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TipPoolAllocation_tipPoolId_userId_key" ON "TipPoolAllocation"("tipPoolId", "userId");

-- CreateIndex
CREATE INDEX "ServiceChargePool_startDate_idx" ON "ServiceChargePool"("startDate");

-- CreateIndex
CREATE INDEX "ServiceChargePool_endDate_idx" ON "ServiceChargePool"("endDate");

-- CreateIndex
CREATE INDEX "ServiceChargePool_status_idx" ON "ServiceChargePool"("status");

-- CreateIndex
CREATE INDEX "ServiceChargePool_postedToPayrollRunId_idx" ON "ServiceChargePool"("postedToPayrollRunId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceChargePool_restaurantId_serviceChargePoolNumber_key" ON "ServiceChargePool"("restaurantId", "serviceChargePoolNumber");

-- CreateIndex
CREATE INDEX "ServiceChargeAllocation_serviceChargePoolId_idx" ON "ServiceChargeAllocation"("serviceChargePoolId");

-- CreateIndex
CREATE INDEX "ServiceChargeAllocation_userId_idx" ON "ServiceChargeAllocation"("userId");

-- CreateIndex
CREATE INDEX "ServiceChargeAllocation_status_idx" ON "ServiceChargeAllocation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceChargeAllocation_serviceChargePoolId_userId_key" ON "ServiceChargeAllocation"("serviceChargePoolId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollSettings_restaurantId_key" ON "PayrollSettings"("restaurantId");

-- CreateIndex
CREATE INDEX "_userLeaveApproval_B_index" ON "_userLeaveApproval"("B");

-- CreateIndex
CREATE INDEX "_userPayrollRun_B_index" ON "_userPayrollRun"("B");

-- CreateIndex
CREATE INDEX "_userPayrollApproval_B_index" ON "_userPayrollApproval"("B");

-- CreateIndex
CREATE INDEX "_userCustomerTip_B_index" ON "_userCustomerTip"("B");

-- CreateIndex
CREATE INDEX "_userTipPool_B_index" ON "_userTipPool"("B");

-- CreateIndex
CREATE INDEX "_userServiceChargePool_B_index" ON "_userServiceChargePool"("B");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicReference_key" ON "Order"("publicReference");

-- CreateIndex
CREATE INDEX "Order_restaurantId_publicOrderStatus_idx" ON "Order"("restaurantId", "publicOrderStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_publicSlug_key" ON "Restaurant"("publicSlug");

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UATScenario" ADD CONSTRAINT "UATScenario_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UATScenario" ADD CONSTRAINT "UATScenario_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UATScenario" ADD CONSTRAINT "UATScenario_testedById_fkey" FOREIGN KEY ("testedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOpeningHour" ADD CONSTRAINT "RestaurantOpeningHour_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHourPeriod" ADD CONSTRAINT "OpeningHourPeriod_openingHourId_fkey" FOREIGN KEY ("openingHourId") REFERENCES "RestaurantOpeningHour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpeningHourPeriod" ADD CONSTRAINT "OpeningHourPeriod_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantSpecialHour" ADD CONSTRAINT "RestaurantSpecialHour_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryZone" ADD CONSTRAINT "DeliveryZone_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_deliveryZoneId_fkey" FOREIGN KEY ("deliveryZoneId") REFERENCES "DeliveryZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableQrToken" ADD CONSTRAINT "TableQrToken_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableQrToken" ADD CONSTRAINT "TableQrToken_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "RestaurantTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrderCancellationRequest" ADD CONSTRAINT "PublicOrderCancellationRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrderCancellationRequest" ADD CONSTRAINT "PublicOrderCancellationRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrderCancellationRequest" ADD CONSTRAINT "PublicOrderCancellationRequest_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicOrderIdempotencyKey" ADD CONSTRAINT "PublicOrderIdempotencyKey_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEmploymentProfile" ADD CONSTRAINT "EmployeeEmploymentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEmploymentProfile" ADD CONSTRAINT "EmployeeEmploymentProfile_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensationProfile" ADD CONSTRAINT "EmployeeCompensationProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensationProfile" ADD CONSTRAINT "EmployeeCompensationProfile_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensationProfile" ADD CONSTRAINT "EmployeeCompensationProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensationProfile" ADD CONSTRAINT "EmployeeCompensationProfile_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveType" ADD CONSTRAINT "LeaveType_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeavePolicy" ADD CONSTRAINT "LeavePolicy_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveBalance" ADD CONSTRAINT "EmployeeLeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveBalance" ADD CONSTRAINT "EmployeeLeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeLeaveBalance" ADD CONSTRAINT "EmployeeLeaveBalance_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerTransaction" ADD CONSTRAINT "LeaveLedgerTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerTransaction" ADD CONSTRAINT "LeaveLedgerTransaction_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerTransaction" ADD CONSTRAINT "LeaveLedgerTransaction_leaveBalanceId_fkey" FOREIGN KEY ("leaveBalanceId") REFERENCES "EmployeeLeaveBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerTransaction" ADD CONSTRAINT "LeaveLedgerTransaction_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerTransaction" ADD CONSTRAINT "LeaveLedgerTransaction_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerTransaction" ADD CONSTRAINT "LeaveLedgerTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApproval" ADD CONSTRAINT "LeaveApproval_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApproval" ADD CONSTRAINT "LeaveApproval_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApproval" ADD CONSTRAINT "LeaveApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApproval" ADD CONSTRAINT "LeaveApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OvertimeApproval" ADD CONSTRAINT "OvertimeApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollComponentDefinition" ADD CONSTRAINT "PayrollComponentDefinition_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRecurringPayrollComponent" ADD CONSTRAINT "EmployeeRecurringPayrollComponent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRecurringPayrollComponent" ADD CONSTRAINT "EmployeeRecurringPayrollComponent_payrollComponentDefiniti_fkey" FOREIGN KEY ("payrollComponentDefinitionId") REFERENCES "PayrollComponentDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRecurringPayrollComponent" ADD CONSTRAINT "EmployeeRecurringPayrollComponent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRecurringPayrollComponent" ADD CONSTRAINT "EmployeeRecurringPayrollComponent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeLine" ADD CONSTRAINT "PayrollEmployeeLine_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeLine" ADD CONSTRAINT "PayrollEmployeeLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeLine" ADD CONSTRAINT "PayrollEmployeeLine_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollEmployeeLine" ADD CONSTRAINT "PayrollEmployeeLine_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_payrollEmployeeLineId_fkey" FOREIGN KEY ("payrollEmployeeLineId") REFERENCES "PayrollEmployeeLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollApproval" ADD CONSTRAINT "PayrollApproval_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollApproval" ADD CONSTRAINT "PayrollApproval_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollApproval" ADD CONSTRAINT "PayrollApproval_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollApproval" ADD CONSTRAINT "PayrollApproval_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDisbursement" ADD CONSTRAINT "PayrollDisbursement_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDisbursement" ADD CONSTRAINT "PayrollDisbursement_payrollEmployeeLineId_fkey" FOREIGN KEY ("payrollEmployeeLineId") REFERENCES "PayrollEmployeeLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDisbursement" ADD CONSTRAINT "PayrollDisbursement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDisbursement" ADD CONSTRAINT "PayrollDisbursement_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDisbursement" ADD CONSTRAINT "PayrollDisbursement_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollDisbursement" ADD CONSTRAINT "PayrollDisbursement_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollEmployeeLineId_fkey" FOREIGN KEY ("payrollEmployeeLineId") REFERENCES "PayrollEmployeeLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_disbursedById_fkey" FOREIGN KEY ("disbursedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvance" ADD CONSTRAINT "StaffAdvance_writtenOffById_fkey" FOREIGN KEY ("writtenOffById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvanceRepayment" ADD CONSTRAINT "StaffAdvanceRepayment_staffAdvanceId_fkey" FOREIGN KEY ("staffAdvanceId") REFERENCES "StaffAdvance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvanceRepayment" ADD CONSTRAINT "StaffAdvanceRepayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvanceRepayment" ADD CONSTRAINT "StaffAdvanceRepayment_payrollEmployeeLineId_fkey" FOREIGN KEY ("payrollEmployeeLineId") REFERENCES "PayrollEmployeeLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvanceRepayment" ADD CONSTRAINT "StaffAdvanceRepayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvanceRepayment" ADD CONSTRAINT "StaffAdvanceRepayment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAdvanceRepayment" ADD CONSTRAINT "StaffAdvanceRepayment_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTip" ADD CONSTRAINT "CustomerTip_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTip" ADD CONSTRAINT "CustomerTip_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTip" ADD CONSTRAINT "CustomerTip_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerTip" ADD CONSTRAINT "CustomerTip_directRecipientUserId_fkey" FOREIGN KEY ("directRecipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPool" ADD CONSTRAINT "TipPool_postedToPayrollRunId_fkey" FOREIGN KEY ("postedToPayrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPoolAllocation" ADD CONSTRAINT "TipPoolAllocation_tipPoolId_fkey" FOREIGN KEY ("tipPoolId") REFERENCES "TipPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPoolAllocation" ADD CONSTRAINT "TipPoolAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipPoolAllocation" ADD CONSTRAINT "TipPoolAllocation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChargePool" ADD CONSTRAINT "ServiceChargePool_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChargePool" ADD CONSTRAINT "ServiceChargePool_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChargePool" ADD CONSTRAINT "ServiceChargePool_calculatedById_fkey" FOREIGN KEY ("calculatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChargePool" ADD CONSTRAINT "ServiceChargePool_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChargePool" ADD CONSTRAINT "ServiceChargePool_postedToPayrollRunId_fkey" FOREIGN KEY ("postedToPayrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChargeAllocation" ADD CONSTRAINT "ServiceChargeAllocation_serviceChargePoolId_fkey" FOREIGN KEY ("serviceChargePoolId") REFERENCES "ServiceChargePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChargeAllocation" ADD CONSTRAINT "ServiceChargeAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceChargeAllocation" ADD CONSTRAINT "ServiceChargeAllocation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollSettings" ADD CONSTRAINT "PayrollSettings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userLeaveApproval" ADD CONSTRAINT "_userLeaveApproval_A_fkey" FOREIGN KEY ("A") REFERENCES "LeaveApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userLeaveApproval" ADD CONSTRAINT "_userLeaveApproval_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userPayrollRun" ADD CONSTRAINT "_userPayrollRun_A_fkey" FOREIGN KEY ("A") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userPayrollRun" ADD CONSTRAINT "_userPayrollRun_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userPayrollApproval" ADD CONSTRAINT "_userPayrollApproval_A_fkey" FOREIGN KEY ("A") REFERENCES "PayrollApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userPayrollApproval" ADD CONSTRAINT "_userPayrollApproval_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userCustomerTip" ADD CONSTRAINT "_userCustomerTip_A_fkey" FOREIGN KEY ("A") REFERENCES "CustomerTip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userCustomerTip" ADD CONSTRAINT "_userCustomerTip_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userTipPool" ADD CONSTRAINT "_userTipPool_A_fkey" FOREIGN KEY ("A") REFERENCES "TipPool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userTipPool" ADD CONSTRAINT "_userTipPool_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userServiceChargePool" ADD CONSTRAINT "_userServiceChargePool_A_fkey" FOREIGN KEY ("A") REFERENCES "ServiceChargePool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_userServiceChargePool" ADD CONSTRAINT "_userServiceChargePool_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

