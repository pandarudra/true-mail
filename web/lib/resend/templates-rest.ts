import type { Resend } from "resend";
import type {
  CreateTemplateOptions,
  UpdateTemplateOptions,
  PaginationOptions,
} from "resend";

export const createTemplate = async (resend: Resend, payload: CreateTemplateOptions) => {
  try {
    const { data, error } = await resend.templates.create(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteTemplate = async (resend: Resend, identifier: string) => {
  try {
    const { data, error } = await resend.templates.remove(identifier);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getTemplate = async (resend: Resend, identifier: string) => {
  try {
    const { data, error } = await resend.templates.get(identifier);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getTemplates = async (resend: Resend, options?: PaginationOptions) => {
  try {
    const { data, error } = await resend.templates.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const duplicateTemplate = async (resend: Resend, identifier: string) => {
  try {
    const { data, error } = await resend.templates.duplicate(identifier);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const publishTemplate = async (resend: Resend, identifier: string) => {
  try {
    const { data, error } = await resend.templates.publish(identifier);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateTemplate = async (
  resend: Resend,
  identifier: string,
  payload: UpdateTemplateOptions
) => {
  try {
    const { data, error } = await resend.templates.update(identifier, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
