export type Result<T, E> = Success<T> | Failure<E>;

export interface Success<T> {
  success: true;
  data: T;
}

export interface Failure<E> {
  success: false;
  error: E;
}

export function ok<T>(data: T): Success<T> {
  return { success: true, data };
}

export function err<E>(error: E): Failure<E> {
  return { success: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

export function isErr<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}

export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) return result.data;
  throw new Error("Called unwrap on an error result");
}

export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) return result.error;
  throw new Error("Called unwrapErr on a success result");
}
