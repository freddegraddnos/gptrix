/** Pure onboarding status for new studios. Three states are kept strictly separate. */
export type OnboardingInput = {
  studio_name?: string | null;
  address?: string | null;
  contact_email?: string | null;
  phone?: string | null;
  styles?: string[] | null;
  onboarding_details_saved_at?: string | null;
  notify_email_enabled?: boolean | null;
  notify_sms_enabled?: boolean | null;
  notify_email?: string | null;
  notify_phone?: string | null;
  notify_test_email_at?: string | null;
  notify_test_sms_at?: string | null;
};

export type OnboardingStatus = {
  studioDone: boolean;
  workDone: boolean;
  notifySaved: boolean;
  detailsSaved: boolean;
  notificationTested: boolean;
  readyForRequests: boolean;
  remaining: Array<"studio" | "work" | "notify" | "test">;
};

const filled = (v?: string | null) => !!v && v.trim().length > 0;

export function onboardingStatus(p: OnboardingInput | null | undefined): OnboardingStatus {
  const r = p ?? {};
  const studioDone = filled(r.studio_name) && filled(r.address) && (filled(r.contact_email) || filled(r.phone));
  const workDone = (r.styles?.length ?? 0) > 0;
  const emailOn = !!r.notify_email_enabled && (filled(r.notify_email) || filled(r.contact_email));
  const smsOn = !!r.notify_sms_enabled && filled(r.notify_phone);
  const notifySaved = emailOn || smsOn;
  const detailsSaved = studioDone && workDone && notifySaved && filled(r.onboarding_details_saved_at);
  const notificationTested = (emailOn && filled(r.notify_test_email_at)) || (smsOn && filled(r.notify_test_sms_at));
  const readyForRequests = detailsSaved && notificationTested;
  const remaining: OnboardingStatus["remaining"] = [];
  if (!studioDone) remaining.push("studio");
  if (!workDone) remaining.push("work");
  if (!notifySaved) remaining.push("notify");
  if (!notificationTested) remaining.push("test");
  return { studioDone, workDone, notifySaved, detailsSaved, notificationTested, readyForRequests, remaining };
}
