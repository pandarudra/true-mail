import type { Resend } from "resend";
import type {
  CreateContactPropertyOptions,
  ListContactPropertiesOptions,
  UpdateContactPropertyOptions,
} from "resend";

export const createContactProperty = async (
  resend: Resend,
  options: CreateContactPropertyOptions
) => {
  try {
    const { data, error } = await resend.contactProperties.create(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getContactProperties = async (
  resend: Resend,
  options?: ListContactPropertiesOptions
) => {
  try {
    const { data, error } = await resend.contactProperties.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getContactProperty = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.contactProperties.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateContactProperty = async (
  resend: Resend,
  payload: UpdateContactPropertyOptions
) => {
  try {
    const { data, error } = await resend.contactProperties.update(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteContactProperty = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.contactProperties.remove(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
