import Ajv, { type ValidateFunction } from 'ajv';
import templateSchema from '../schema/vrata_template.schema.json';
import enrollmentSchema from '../schema/enrollment.schema.json';
import progressSchema from '../schema/progress.schema.json';
import type { Enrollment, VrataTemplate } from './types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const ajv = new Ajv({ allErrors: true, strict: true, strictTypes: false, strictRequired: false });
const templateValidator = ajv.compile(templateSchema);
const enrollmentValidator = ajv.compile(enrollmentSchema);
const progressValidator = ajv.compile(progressSchema);

function run(validator: ValidateFunction, data: unknown): ValidationResult {
  const valid = validator(data) as boolean;
  const errors = (validator.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}${
    e.params && 'additionalProperty' in e.params ? ` (${String(e.params.additionalProperty)})` : ''
  }${e.params && 'missingProperty' in e.params ? ` (${String(e.params.missingProperty)})` : ''}`);
  return { valid, errors };
}

export const validateTemplate = (data: unknown): ValidationResult => run(templateValidator, data);
export const validateEnrollment = (data: unknown): ValidationResult => run(enrollmentValidator, data);
export const validateProgress = (data: unknown): ValidationResult => run(progressValidator, data);

/** Cross-file checks the JSON Schemas cannot express. */
export function validateReferences(template: VrataTemplate, enrollment: Enrollment): ValidationResult {
  const errors: string[] = [];
  if (enrollment.template_id !== template.template_id) {
    errors.push(`enrollment.template_id "${enrollment.template_id}" does not match template "${template.template_id}"`);
  }
  if (enrollment.template_version !== template.version) {
    errors.push(`enrollment pins template version ${enrollment.template_version} but template is version ${template.version}`);
  }
  if (!template.pradakshina_methods[enrollment.pradakshina_method]) {
    errors.push(`pradakshina_method "${enrollment.pradakshina_method}" not defined in template`);
  }
  const ruleIds = new Set(template.rules.map((r) => r.id));
  for (const id of Object.keys(enrollment.rule_overrides)) {
    if (!ruleIds.has(id)) errors.push(`rule_overrides refers to unknown rule "${id}"`);
  }
  for (const rule of template.rules) {
    if (rule.resource !== null && !template.resources[rule.resource]) {
      errors.push(`rule "${rule.id}" refers to unknown resource "${rule.resource}"`);
    }
  }
  return { valid: errors.length === 0, errors };
}
