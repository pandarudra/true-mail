import type { Resend } from "resend";
import type {
  CreateContactOptions,
  LegacyCreateContactOptions,
  CreateContactRequestOptions,
  ListContactsOptions,
  GetContactOptions,
  UpdateContactOptions,
  RemoveContactOptions,
  CreateContactImportOptions,
  CreateContactImportRequestOptions,
  ListContactImportsOptions,
  ListContactSegmentsOptions,
  AddContactSegmentOptions,
  RemoveContactSegmentOptions,
  UpdateContactTopicsOptions,
  ListContactTopicsOptions,
} from "resend";

export const createContact = async (
  resend: Resend,
  payload: CreateContactOptions | LegacyCreateContactOptions,
  options?: CreateContactRequestOptions
) => {
  try {
    const { data, error } = await resend.contacts.create(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getContacts = async (resend: Resend, options?: ListContactsOptions) => {
  try {
    const { data, error } = await resend.contacts.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getContact = async (resend: Resend, options: GetContactOptions) => {
  try {
    const { data, error } = await resend.contacts.get(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateContact = async (resend: Resend, options: UpdateContactOptions) => {
  try {
    const { data, error } = await resend.contacts.update(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteContact = async (resend: Resend, payload: RemoveContactOptions) => {
  try {
    const { data, error } = await resend.contacts.remove(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const createContactImport = async (
  resend: Resend,
  payload: CreateContactImportOptions,
  options?: CreateContactImportRequestOptions
) => {
  try {
    const { data, error } = await resend.contacts.imports.create(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getContactImports = async (resend: Resend, options?: ListContactImportsOptions) => {
  try {
    const { data, error } = await resend.contacts.imports.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getContactImport = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.contacts.imports.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getContactSegments = async (resend: Resend, options: ListContactSegmentsOptions) => {
  try {
    const { data, error } = await resend.contacts.segments.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const addContactSegment = async (resend: Resend, options: AddContactSegmentOptions) => {
  try {
    const { data, error } = await resend.contacts.segments.add(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const removeContactSegment = async (
  resend: Resend,
  options: RemoveContactSegmentOptions
) => {
  try {
    const { data, error } = await resend.contacts.segments.remove(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateContactTopics = async (
  resend: Resend,
  payload: UpdateContactTopicsOptions
) => {
  try {
    const { data, error } = await resend.contacts.topics.update(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getContactTopics = async (resend: Resend, options: ListContactTopicsOptions) => {
  try {
    const { data, error } = await resend.contacts.topics.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
