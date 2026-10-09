import type { Enrollment, Rule, VrataTemplate } from './types';

/** Rules in force for this enrollment: the devotee's override wins, else the template default. */
export function getActiveRules(template: VrataTemplate, enrollment: Enrollment): Rule[] {
  return template.rules.filter((r) => enrollment.rule_overrides[r.id] ?? r.default_enabled);
}

/** Active rules sorted by template.category_order (stable within a category). */
export function getOrderedActiveRules(template: VrataTemplate, enrollment: Enrollment): Rule[] {
  const order = (c: string) => {
    const i = template.category_order.indexOf(c as never);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return getActiveRules(template, enrollment)
    .map((rule, idx) => ({ rule, idx }))
    .sort((a, b) => order(a.rule.category) - order(b.rule.category) || a.idx - b.idx)
    .map((x) => x.rule);
}

export function getPradakshinaMethod(template: VrataTemplate, enrollment: Enrollment) {
  const method = template.pradakshina_methods[enrollment.pradakshina_method];
  if (!method) {
    throw new Error(`Pradakshina method "${enrollment.pradakshina_method}" not found in template ${template.template_id}`);
  }
  return method;
}
