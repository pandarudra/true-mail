import type { Resend } from "resend";
import type { CreateBatchOptions, CreateBatchRequestOptions } from "resend";

export const sendBatchEmails = async (
  resend: Resend,
  payload: CreateBatchOptions,
  options?: CreateBatchRequestOptions
) => {
  try {
    const { data, error } = await resend.batch.send(payload, options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
