import type { Resend } from "resend";
import type {
  CreateSegmentOptions,
  CreateSegmentRequestOptions,
  ListSegmentsOptions,
  UpdateSegmentOptions,
} from "resend";

export const createSegment = async (
  resend: Resend,
  payload: CreateSegmentOptions,
  options?: CreateSegmentRequestOptions
) => {
  try {
    const { data, error } = await resend.segments.create(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getSegments = async (resend: Resend, options?: ListSegmentsOptions) => {
  try {
    const { data, error } = await resend.segments.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getSegment = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.segments.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const updateSegment = async (resend: Resend, id: string, payload: UpdateSegmentOptions) => {
  try {
    const { data, error } = await resend.segments.update(id, payload);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const deleteSegment = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.segments.remove(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
