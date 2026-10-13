/**
 * Tool execution context.
 *
 * SECURITY: every field here is derived server-side from the authenticated
 * session. No tool ever accepts tenantId, userId or role as a model-supplied
 * argument — work-order descriptions and customer complaints are attacker-
 * controllable text that reaches the model, so a model-supplied tenantId would
 * be a cross-tenant data-exfiltration path.
 */
import { UserRole } from '@prisma/client';

export interface ToolContext {
  tenantId: string;
  userId: string;
  branchId: string | null;
  role: UserRole;
  /** Preferred language for generated summaries. */
  language: 'ar' | 'en';
}

/** Tools that change data. These never run without explicit user confirmation. */
export const WRITE_TOOLS = new Set([
  'create_work_order',
  'assign_task',
  'update_work_order_status',
  'create_part_request',
  'add_work_order_item',
]);

/**
 * Which tools each role may use. The agent receives only its role's tools in
 * the request — restricted tools are absent from the tool list rather than
 * present-but-forbidden, so the model cannot be talked into calling them.
 */
export const ROLE_TOOLS: Record<UserRole, string[]> = {
  SUPER_ADMIN: [
    'get_work_order',
    'search_work_orders',
    'get_vehicle_history',
    'find_similar_faults',
    'check_part_availability',
    'get_financial_summary',
  ],
  GARAGE_OWNER: [
    'get_work_order',
    'search_work_orders',
    'get_vehicle_history',
    'find_similar_faults',
    'check_part_availability',
    'get_financial_summary',
    'create_work_order',
    'assign_task',
    'update_work_order_status',
    'create_part_request',
    'add_work_order_item',
  ],
  BRANCH_MANAGER: [
    'get_work_order',
    'search_work_orders',
    'get_vehicle_history',
    'find_similar_faults',
    'check_part_availability',
    'create_work_order',
    'assign_task',
    'update_work_order_status',
    'create_part_request',
    'add_work_order_item',
  ],
  ACCOUNTANT: [
    'get_work_order',
    'search_work_orders',
    'get_vehicle_history',
    'check_part_availability',
    'get_financial_summary',
  ],
  RECEPTIONIST: [
    'get_work_order',
    'search_work_orders',
    'get_vehicle_history',
    'find_similar_faults',
    'create_work_order',
  ],
  TECHNICIAN: [
    'get_work_order',
    'get_vehicle_history',
    'find_similar_faults',
    'check_part_availability',
    'update_work_order_status',
    'create_part_request',
  ],
};

export function toolsForRole(role: UserRole): string[] {
  return ROLE_TOOLS[role] ?? [];
}

export function isWriteTool(name: string): boolean {
  return WRITE_TOOLS.has(name);
}
