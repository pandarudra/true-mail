import type { Resend } from "resend";
import type {
  CreateApiKeyOptions,
  CreateApiKeyRequestOptions,
  ListApiKeysOptions,
  UpdateApiKeyOptions,
} from "resend";

export const createApiKey = async (
  resend: Resend,
  payload: CreateApiKeyOptions,
  options?: CreateApiKeyRequestOptions
) => {
  try {
    const { data, error } = await resend.apiKeys.create(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getApiKeys = async (resend: Resend, options?: ListApiKeysOptions) => {
  try {
    const { data, error } = await resend.apiKeys.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateApiKey = async (resend: Resend, id: string, payload: UpdateApiKeyOptions) => {
  try {
    const { data, error } = await resend.apiKeys.update(id, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteApiKey = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.apiKeys.remove(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
