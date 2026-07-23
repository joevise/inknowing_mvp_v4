/**
 * 权限模块统一导出
 */

export type { FeatureKey, PlanFeatures, CheckResult } from './types';
export {
  getUserPlan,
  getUserFeatures,
  checkPermission,
  checkDailyLimit,
  checkCharacterLimit,
  invalidateUserCache,
} from './check';
export { seedDefaultPlans } from './seed';
