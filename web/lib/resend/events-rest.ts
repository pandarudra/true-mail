import type { Resend } from "resend";
import type {
  SendEventOptions,
  CreateEventOptions,
  ListEventsOptions,
  UpdateEventOptions,
} from "resend";

export const sendEvent = async (resend: Resend, payload: SendEventOptions) => {
  try {
    const { data, error } = await resend.events.send(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const createEvent = async (resend: Resend, payload: CreateEventOptions) => {
  try {
    const { data, error } = await resend.events.create(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getEvent = async (resend: Resend, identifier: string) => {
  try {
    const { data, error } = await resend.events.get(identifier);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getEvents = async (resend: Resend, options?: ListEventsOptions) => {
  try {
    const { data, error } = await resend.events.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateEvent = async (
  resend: Resend,
  identifier: string,
  payload: UpdateEventOptions
) => {
  try {
    const { data, error } = await resend.events.update(identifier, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteEvent = async (resend: Resend, identifier: string) => {
  try {
    const { data, error } = await resend.events.remove(identifier);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
