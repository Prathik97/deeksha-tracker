export type Category = 'morning' | 'all_day' | 'diet' | 'abstinence' | 'conduct' | 'pradakshina';
export type RuleCategory = Exclude<Category, 'pradakshina'>;
export type EntryStatus = 'on_time' | 'late';
export type MantraMethod = 'video' | 'manual';

export interface Resource {
  label: string;
  url: string;
  note?: string;
}

export interface PradakshinaMethod {
  label: string;
  rounds_per_session: number;
  total_sessions_required?: number;
  sessions_per_week?: number;
  note?: string;
}

export interface Rule {
  id: string;
  label: string;
  category: RuleCategory;
  default_enabled: boolean;
  mandatory: boolean;
  resource: string | null;
}

export interface SpecialAction {
  id: string;
  label: string;
}

export interface SpecialDay {
  label: string;
  actions: SpecialAction[];
}

export interface VrataTemplate {
  template_id: string;
  version: number;
  vrata_type: string;
  name: string;
  duration_days: number;
  default_locale: string;
  temple: { temple_id: string; name: string; city: string; address?: string };
  category_order: Category[];
  resources: Record<string, Resource>;
  pradakshina_methods: Record<string, PradakshinaMethod>;
  rules: Rule[];
  special_days: Record<string, SpecialDay>;
}

export interface Enrollment {
  enrollment_id: string;
  devotee: { id: string; name: string };
  template_id: string;
  template_version: number;
  start_date: string;
  timezone: string;
  reminder_time: string;
  pradakshina_method: string;
  /** Day numbers the devotee plans to do pradakshina on. Empty or absent = not yet set. */
  planned_pradakshina_days?: number[];
  rule_overrides: Record<string, boolean>;
}

export interface DayEntry {
  day_number: number;
  entry_status: EntryStatus;
  logged_at: string;
  rules_checked: Record<string, boolean | null>;
  flags: string[];
  mantra_method: MantraMethod | null;
  pradakshina_done: boolean;
  notes: string;
}

export interface Progress {
  enrollment_id: string;
  is_complete: boolean;
  pradakshina_dates: string[];
  special_actions_done: Record<string, Record<string, boolean>>;
  days: Record<string, DayEntry>;
}

/** Anything that identifies "now": a real instant, or a YYYY-MM-DD calendar date already in the enrollment timezone. */
export type DateInput = Date | string;

export interface PradakshinaStatus {
  method: string;
  method_label: string;
  rounds_per_session: number;
  /** 'vrata' = total across the whole vrata (four_days); 'week' = current week window (weekly_twice). */
  scope: 'vrata' | 'week';
  done: number;
  required: number;
  remaining: number;
  warning: string | null;
}

export interface CheckinAnswers {
  /** rule id -> true | false | null (skip). Rules not present are left as they are (null for a new entry). */
  rules?: Record<string, boolean | null>;
  mantra_method?: MantraMethod | null;
  pradakshina_done?: boolean;
  /** action id -> done, stored under special_actions_done.day_N when that day has special actions. */
  special_actions?: Record<string, boolean>;
  notes?: string;
}

export interface CheckinContext {
  template: VrataTemplate;
  enrollment: Enrollment;
  /** ISO timestamp with offset. Passed in so applyCheckin stays pure. */
  loggedAt: string;
}
