import type { Resend } from "resend";
import type {
  AddSuppressionOptions,
  ListSuppressionsOptions,
  BatchAddSuppressionsOptions,
  BatchRemoveSuppressionsOptions,
} from "resend";

export const addSuppression = async (resend: Resend, options: AddSuppressionOptions) => {
  try {
    const { data, error } = await resend.suppressions.add(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getSuppressions = async (resend: Resend, options?: ListSuppressionsOptions) => {
  try {
    const { data, error } = await resend.suppressions.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getSuppression = async (resend: Resend, idOrEmail: string) => {
  try {
    const { data, error } = await resend.suppressions.get(idOrEmail);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteSuppression = async (resend: Resend, idOrEmail: string) => {
  try {
    const { data, error } = await resend.suppressions.remove(idOrEmail);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const batchAddSuppressions = async (
  resend: Resend,
  options: BatchAddSuppressionsOptions
) => {
  try {
    const { data, error } = await resend.suppressions.batch.add(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const batchRemoveSuppressions = async (
  resend: Resend,
  options: BatchRemoveSuppressionsOptions
) => {
  try {
    const { data, error } = await resend.suppressions.batch.remove(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
