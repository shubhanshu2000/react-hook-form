import * as React from 'react';

import get from './utils/get';
import { Control, FieldValues, FormSubmitHandler } from './types';
import { useFormContext } from './useFormContext';

export type FormProps<
  TFieldValues extends FieldValues,
  TTransformedValues extends FieldValues | undefined = undefined,
> = Partial<{
  control: Control<TFieldValues>;
  children?: React.ReactNode | React.ReactNode[];
  render?: (props: {
    submit: (e?: React.FormEvent) => void;
  }) => React.ReactNode | React.ReactNode[];
  onSubmit: TTransformedValues extends FieldValues
    ? FormSubmitHandler<TTransformedValues>
    : FormSubmitHandler<TFieldValues>;
}> &
  Omit<React.FormHTMLAttributes<HTMLFormElement>, 'onError'> &
  (
    | Partial<{
        onSuccess: ({ response }: { response: Response }) => void;
        onError: ({
          response,
          error,
        }:
          | {
              response: Response;
              error?: undefined;
            }
          | {
              response?: undefined;
              error: unknown;
            }) => void;
        headers: Record<string, string>;
        validateStatus: (status: number) => boolean;
      }>
    | Partial<{
        onSuccess: undefined;
        onError: undefined;
        validateStatus: undefined;
        headers: undefined;
      }>
  ) & {
    method?: 'post' | 'put' | 'delete';
  };

const POST_REQUEST = 'post';

/**
 * Form component to manage submission.
 *
 * @param props - to setup submission detail. {@link FormProps}
 *
 * @returns form component or headless render prop.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { control, formState: { errors } } = useForm();
 *
 *   return (
 *     <Form action="/api" control={control}>
 *       <input {...register("name")} />
 *       <p>{errors?.root?.server && 'Server error'}</p>
 *       <button>Submit</button>
 *     </Form>
 *   );
 * }
 * ```
 */
export function Form<
  T extends FieldValues,
  U extends FieldValues | undefined = undefined,
>(props: FormProps<T, U>) {
  const methods = useFormContext<T>();
  const [mounted, setMounted] = React.useState(false);
  const {
    control = methods.control,
    onSubmit,
    children,
    action,
    method = POST_REQUEST,
    headers,
    encType,
    onError,
    render,
    onSuccess,
    validateStatus,
    ...rest
  } = props;

  const submit = async (event?: React.BaseSyntheticEvent) => {
    let serverError = false;

    await control.handleSubmit(async (data) => {
      const formData = new FormData();
      let formDataJson = '';

      try {
        formDataJson = JSON.stringify(data);
      } catch {}

      for (const name of control._names.mount) {
        formData.append(name, get(data, name));
      }

      if (onSubmit) {
        onSubmit({
          data,
          event,
          action,
          method,
          formData,
          formDataJson,
        });
      }

      if (action) {
        try {
          const shouldStringifySubmissionData =
            headers && headers['Content-Type'].includes('json');

          const response = await fetch(action, {
            method,
            headers: {
              ...headers,
              ...(encType ? { 'Content-Type': encType } : {}),
            },
            body: shouldStringifySubmissionData ? formDataJson : formData,
          });

          if (
            response &&
            (validateStatus
              ? !validateStatus(response.status)
              : response.status < 200 || response.status >= 300)
          ) {
            serverError = true;
            onError && onError({ response });
          } else {
            onSuccess && onSuccess({ response });
          }
        } catch (error: unknown) {
          serverError = true;
          onError && onError({ error });
        }
      }
    })(event);

    serverError &&
      props.control &&
      props.control._subjects.state.next({
        isSubmitSuccessful: false,
      });
  };

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return render ? (
    <>
      {render({
        submit,
      })}
    </>
  ) : (
    <form
      noValidate={mounted}
      action={action}
      method={method}
      encType={encType}
      onSubmit={submit}
      {...rest}
    >
      {children}
    </form>
  );
}
