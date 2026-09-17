import type { Resend } from "resend";
import type {
  CreateBroadcastOptions,
  CreateBroadcastRequestOptions,
  SendBroadcastOptions,
  ListBroadcastsOptions,
  ListBroadcastRecipientsOptions,
  ListBroadcastClickedLinksOptions,
  UpdateBroadcastOptions,
  BroadcastRecipientEventType,
} from "resend";

export const createBroadcast = async (
  resend: Resend,
  payload: CreateBroadcastOptions,
  options?: CreateBroadcastRequestOptions
) => {
  try {
    const { data, error } = await resend.broadcasts.create(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const sendBroadcast = async (resend: Resend, id: string, payload?: SendBroadcastOptions) => {
  try {
    const { data, error } = await resend.broadcasts.send(id, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getBroadcasts = async (resend: Resend, options?: ListBroadcastsOptions) => {
  try {
    const { data, error } = await resend.broadcasts.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getBroadcast = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.broadcasts.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getBroadcastRecipients = async <T extends BroadcastRecipientEventType>(
  resend: Resend,
  id: string,
  options: ListBroadcastRecipientsOptions<T>
) => {
  try {
    const { data, error } = await resend.broadcasts.recipients(id, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getBroadcastClickedLinks = async (
  resend: Resend,
  id: string,
  options?: ListBroadcastClickedLinksOptions
) => {
  try {
    const { data, error } = await resend.broadcasts.clickedLinks(id, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteBroadcast = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.broadcasts.remove(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const cancelBroadcast = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.broadcasts.cancel(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const duplicateBroadcast = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.broadcasts.duplicate(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateBroadcast = async (
  resend: Resend,
  id: string,
  payload: UpdateBroadcastOptions
) => {
  try {
    const { data, error } = await resend.broadcasts.update(id, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
