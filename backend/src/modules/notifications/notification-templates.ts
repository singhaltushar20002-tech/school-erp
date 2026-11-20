import type { NotificationEvent } from '~/modules/settings/settings.types';
import type { Locale } from '~/shared/locale/locales';

export type TemplateLocale = Locale;
export type TemplateChannel = 'inApp' | 'email';

export interface TemplateText {
  subject: string;
  body: string;
}

/**
 * The code defaults for each notification (PRD 6.13), in every language
 * of `LOCALES`. Variables are `{name}`; a school overrides any of them per
 * channel and language in `notification_templates`.
 */
export const DEFAULT_TEMPLATES: Record<
  NotificationEvent,
  Record<TemplateLocale, TemplateText>
> = {
  absent: {
    en: {
      subject: '{student_name} was absent today',
      body: '{student_name} ({class_name}) was marked absent on {date}.',
    },
    hi: {
      subject: '{student_name} आज अनुपस्थित रहे',
      body: '{student_name} ({class_name}) को {date} को अनुपस्थित दर्ज किया गया।',
    },
  },
  feeDue: {
    en: {
      subject: 'Fees due for {student_name}',
      body: '{student_name} has {amount} in fees due since {due_date}. Please pay at the school office or online.',
    },
    hi: {
      subject: '{student_name} की फ़ीस बकाया है',
      body: '{student_name} की {due_date} से {amount} फ़ीस बकाया है। कृपया विद्यालय कार्यालय में या ऑनलाइन भुगतान करें।',
    },
  },
  paymentReceived: {
    en: {
      subject: 'Payment received: {amount}',
      body: 'We received {amount} (receipt {receipt_number}) for {student_name}. Thank you.',
    },
    hi: {
      subject: 'भुगतान प्राप्त हुआ: {amount}',
      body: '{student_name} के लिए {amount} प्राप्त हुए (रसीद {receipt_number})। धन्यवाद।',
    },
  },
  resultPublished: {
    en: {
      subject: '{result_name} results are out',
      body: "{student_name}'s {result_name} result has been published.",
    },
    hi: {
      subject: '{result_name} का परिणाम घोषित हो गया है',
      body: '{student_name} का {result_name} परिणाम प्रकाशित कर दिया गया है।',
    },
  },
  noticePublished: {
    en: { subject: 'Notice: {title}', body: '{summary}' },
    hi: { subject: 'सूचना: {title}', body: '{summary}' },
  },
};

/** Replaces `{name}` with `vars.name` (unknown names stay as written). */
export function render(
  text: string,
  vars: Record<string, string | number>,
): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}
