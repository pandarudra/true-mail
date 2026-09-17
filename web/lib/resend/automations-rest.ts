import type { Resend } from "resend";
import type {
  CreateAutomationOptions,
  ListAutomationsOptions,
  UpdateAutomationOptions,
  GetAutomationRunOptions,
  ListAutomationRunsOptions,
} from "resend";

export const createAutomation = async (resend: Resend, payload: CreateAutomationOptions) => {
  try {
    const { data, error } = await resend.automations.create(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getAutomations = async (resend: Resend, options?: ListAutomationsOptions) => {
  try {
    const { data, error } = await resend.automations.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getAutomation = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.automations.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteAutomation = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.automations.remove(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateAutomation = async (
  resend: Resend,
  id: string,
  payload: UpdateAutomationOptions
) => {
  try {
    const { data, error } = await resend.automations.update(id, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const duplicateAutomation = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.automations.duplicate(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const stopAutomation = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.automations.stop(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getAutomationRun = async (resend: Resend, options: GetAutomationRunOptions) => {
  try {
    const { data, error } = await resend.automations.runs.get(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getAutomationRuns = async (resend: Resend, options: ListAutomationRunsOptions) => {
  try {
    const { data, error } = await resend.automations.runs.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
