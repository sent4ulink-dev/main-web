/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatePlan } from '../types';

export interface PlanMessageOptions {
  heading?: string;
  message?: string;
  formattedDate?: string;
}

/** The same plan text used for the SMS body and (as a subject line elsewhere) the
 * share-image caption — one source of truth for "what does our confirmed plan say". */
export function buildPlanText(plan: DatePlan, options: PlanMessageOptions = {}): string {
  const lines = [
    options.heading?.trim() || "It's official — our date is set!",
    '',
    `Activity: ${plan.activity || 'TBA'}`,
    `Date: ${options.formattedDate || plan.date || 'TBA'}`,
    `Time: ${plan.time || 'TBA'}`,
    `Place: ${plan.restaurant || 'TBA'}`
  ];
  if (plan.mapsLink) lines.push(`Maps: ${plan.mapsLink}`);
  if (options.message?.trim()) {
    lines.push('', `"${options.message.trim()}"`);
  }
  return lines.join('\n');
}

function isIOS(): boolean {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPad|iPhone|iPod/.test(ua) || /iPad|iPhone|iPod/.test(platform);
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent || '');
}

/**
 * The sms: URI scheme's query-string separator differs by platform: iOS expects
 * "sms:&body=…" (an ampersand even with no recipient before it), while Android (and
 * everything else that supports sms: at all) expects "sms:?body=…". Getting this wrong
 * is the single most common reason a "text me the plan" link silently fails to
 * pre-fill the body on one platform or the other.
 */
export function buildSmsHref(body: string, recipient = ''): string {
  const separator = isIOS() ? '&' : '?';
  return `sms:${recipient}${separator}body=${encodeURIComponent(body)}`;
}

export { isIOS, isAndroid };

/** Opens the phone's SMS composer with the plan pre-filled — never sends automatically,
 * just like tapping a sms: link anywhere else only opens the app. */
export function openSmsComposer(plan: DatePlan, options: PlanMessageOptions = {}): void {
  const text = buildPlanText(plan, options);
  window.location.href = buildSmsHref(text);
}
