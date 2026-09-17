import type { Resend } from "resend";
import type {
  CreateEmailOptions,
  CreateEmailRequestOptions,
  UpdateEmailOptions,
  ListEmailsOptions,
  ShareEmailOptions,
  GetEmailsMetricsOptions,
  GetAttachmentOptions,
  ListAttachmentsOptions,
} from "resend";

export const sendEmail = async (
  resend: Resend,
  payload: CreateEmailOptions,
  options?: CreateEmailRequestOptions
) => {
  try {
    const { data, error } = await resend.emails.send(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getEmail = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.emails.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getEmails = async (resend: Resend, options?: ListEmailsOptions) => {
  try {
    const { data, error } = await resend.emails.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateEmail = async (resend: Resend, payload: UpdateEmailOptions) => {
  try {
    const { data, error } = await resend.emails.update(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const cancelEmail = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.emails.cancel(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const shareEmail = async (resend: Resend, id: string, payload?: ShareEmailOptions) => {
  try {
    const { data, error } = await resend.emails.share(id, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getEmailsMetrics = async (resend: Resend, options?: GetEmailsMetricsOptions) => {
  try {
    const { data, error } = await resend.emails.metrics(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getEmailAttachment = async (resend: Resend, options: GetAttachmentOptions) => {
  try {
    const { data, error } = await resend.emails.attachments.get(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getEmailAttachments = async (resend: Resend, options: ListAttachmentsOptions) => {
  try {
    const { data, error } = await resend.emails.attachments.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
