import type { Resend } from "resend";
import type { ListLogsOptions } from "resend";

export const getLogs = async (resend: Resend, options?: ListLogsOptions) => {
  try {
    const { data, error } = await resend.logs.list(options);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};

export const getLog = async (resend: Resend, id: string) => {
  try {
    const { data, error } = await resend.logs.get(id);
    if (error) throw new Error(error.message);
    return { data };
  } catch (error) {
    console.log(error);
  }
};
