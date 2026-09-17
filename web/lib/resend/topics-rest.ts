import type { Resend } from "resend";
import type { CreateTopicOptions, UpdateTopicOptions } from "resend";

export const createTopic = async (resend: Resend, payload: CreateTopicOptions) => {
  try {
    const { data, error } = await resend.topics.create(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getTopics = async (resend: Resend) => {
  try {
    const { data, error } = await resend.topics.list();
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getTopic = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.topics.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateTopic = async (resend: Resend, payload: UpdateTopicOptions) => {
  try {
    const { data, error } = await resend.topics.update(payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteTopic = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.topics.remove(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
