import type { ComponentType } from 'react'
import { template as newMessageTemplate } from './new-message'
import { template as seoAlertTemplate } from './seo-alert'
import { template as bookingRequestTemplate } from './booking-request'
import { template as bookingStatusTemplate } from './booking-status'
import { template as studioOtpTemplate } from './studio-otp'
import { template as bookingReminderTemplate } from './booking-reminder'
import { template as bookingReceivedTemplate } from './booking-received'
import { template as studioApprovalRequestTemplate } from './studio-approval-request'
import { template as studioApprovalResultTemplate } from './studio-approval-result'
import { template as studioRequestTemplate } from './studio-request'
import { template as studioBookingMessageTemplate } from './studio-booking-message'
import { template as studioInterestTemplate } from './studio-interest'
import { template as studioTestNoticeTemplate } from './studio-test-notice'
import { template as studioWelcomeTemplate } from './studio-welcome'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'new-message': newMessageTemplate,
  'seo-alert': seoAlertTemplate,
  'booking-request': bookingRequestTemplate,
  'booking-status': bookingStatusTemplate,
  'studio-otp': studioOtpTemplate,
  'booking-reminder': bookingReminderTemplate,
  'booking-received': bookingReceivedTemplate,
  'studio-approval-request': studioApprovalRequestTemplate,
  'studio-approval-result': studioApprovalResultTemplate,
  'studio-request': studioRequestTemplate,
  'studio-booking-message': studioBookingMessageTemplate,
  'studio-interest': studioInterestTemplate,
  'studio-test-notice': studioTestNoticeTemplate,
  'studio-welcome': studioWelcomeTemplate,
}
