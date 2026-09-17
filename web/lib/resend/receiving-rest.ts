import type { Resend } from "resend";
import type {
  GetReceivingEmailOptions,
  ListReceivingEmailsOptions,
  ForwardReceivingEmailOptions,
  ForwardReceivingEmailRequestOptions,
  GetAttachmentOptions,
  ListAttachmentsOptions,
} from "resend";

export const getReceivedEmail = async (
  resend: Resend,
  id: string,
  options?: GetReceivingEmailOptions
) => {
  try {
    const { data, error } = await resend.emails.receiving.get(id, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getReceivedEmails = async (
  resend: Resend,
  options?: ListReceivingEmailsOptions
) => {
  try {
    const { data, error } = await resend.emails.receiving.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const forwardReceivedEmail = async (
  resend: Resend,
  options: ForwardReceivingEmailOptions,
  requestOptions?: ForwardReceivingEmailRequestOptions
) => {
  try {
    const { data, error } = await resend.emails.receiving.forward(options, requestOptions);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getReceivingAttachment = async (resend: Resend, options: GetAttachmentOptions) => {
  try {
    const { data, error } = await resend.emails.receiving.attachments.get(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getReceivingAttachments = async (
  resend: Resend,
  options: ListAttachmentsOptions
) => {
  try {
    const { data, error } = await resend.emails.receiving.attachments.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
