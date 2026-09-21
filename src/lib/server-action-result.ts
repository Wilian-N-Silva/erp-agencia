export type ServerActionErrorCode = "RATE_LIMITED";

export type ServerActionResult<Data = undefined> =
  | {
      data: Data;
      ok: true;
    }
  | {
      code: ServerActionErrorCode;
      message: string;
      ok: false;
      retryAfterSeconds?: number;
    };

export type FormServerAction<Data = undefined> = (
  formData: FormData,
) => Promise<ServerActionResult<Data>>;

export function serverActionSuccess<Data>(data: Data): ServerActionResult<Data> {
  return { data, ok: true };
}
