import type { Resend } from "resend";
import type {
  CreateWebhookOptions,
  CreateWebhookRequestOptions,
  UpdateWebhookOptions,
  ListWebhooksOptions,
  ListWebhookEventsOptions,
  GetWebhookEventOptions,
  ReplayWebhookEventOptions,
  ListWebhookEventAttemptsOptions,
} from "resend";

export const createWebhook = async (
  resend: Resend,
  payload: CreateWebhookOptions,
  options?: CreateWebhookRequestOptions
) => {
  try {
    const { data, error } = await resend.webhooks.create(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getWebhook = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.webhooks.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getWebhooks = async (resend: Resend, options?: ListWebhooksOptions) => {
  try {
    const { data, error } = await resend.webhooks.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateWebhook = async (resend: Resend, id: string, payload: UpdateWebhookOptions) => {
  try {
    const { data, error } = await resend.webhooks.update(id, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteWebhook = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.webhooks.remove(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const rotateWebhookSigningSecret = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.webhooks.rotateSigningSecret(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const verifyWebhookPayload = (
  resend: Resend,
  options: Parameters<Resend["webhooks"]["verify"]>[0]
) => resend.webhooks.verify(options);

export const getWebhookEvents = async (resend: Resend, options: ListWebhookEventsOptions) => {
  try {
    const { data, error } = await resend.webhooks.events.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getWebhookEvent = async (resend: Resend, options: GetWebhookEventOptions) => {
  try {
    const { data, error } = await resend.webhooks.events.get(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const replayWebhookEvent = async (resend: Resend, options: ReplayWebhookEventOptions) => {
  try {
    const { data, error } = await resend.webhooks.events.replay(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getWebhookEventAttempts = async (
  resend: Resend,
  options: ListWebhookEventAttemptsOptions
) => {
  try {
    const { data, error } = await resend.webhooks.events.attempts.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
