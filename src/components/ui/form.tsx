/**
 * Form — compound-component shadcn pattern.
 *
 * Uses two intra-island React Contexts (FormFieldContext, FormItemContext)
 * to pass field name / item id down to FormControl, FormLabel,
 * FormDescription, FormMessage. These Contexts NEVER cross an Astro island
 * boundary — the entire <Form>...</Form> composition lives in one file and
 * is hydrated as a single island (per CLAUDE.md "compound-component gotcha").
 *
 * CLAUDE.md's prohibition on React.createContext is specifically about
 * sharing state ACROSS islands. Intra-island Context is the documented
 * pattern for compound components. See:
 *   https://ui.shadcn.com/docs/components/form (Radix original)
 *   CLAUDE.md → "shadcn/ui + Astro: the compound-component gotcha"
 */
import * as React from 'react';
import { Field } from '@base-ui-components/react/field';
import {
  type ControllerProps,
  type FieldPath,
  type FieldValues,
  FormProvider,
  useFormContext,
  Controller,
} from 'react-hook-form';

import { cn } from '@/lib/cn';
import { Label } from '@/components/ui/label';

// Form built around react-hook-form's FormProvider + Controller, with Base UI's
// Field primitive providing accessibility structure (label → control → error linking).
// Mirrors the shadcn/ui API so consumers don't need to relearn.

// Form is FormProvider re-exported with the same name for shadcn parity.
const Form = FormProvider;

// Context for passing the field name down to FormItem children
type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

// intra-island only — see file header
const FormFieldContext = React.createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

// FormField wraps react-hook-form's Controller and provides the field name via context
function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  return (
    <FormFieldContext.Provider value={{ name: props.name }}>
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
}

// Provides the per-FormItem id that FormLabel/FormControl/FormDescription/
// FormMessage all derive their ids from, so htmlFor/id/aria-describedby stay
// linked — the piece the file header always documented but never actually
// defined until a real axe-core "select-name" critical failure on
// ShowcaseFieldType's demo <select> exposed the gap (see form.test.ts).
type FormItemContextValue = { id: string };
const FormItemContext = React.createContext<FormItemContextValue>(
  {} as FormItemContextValue,
);

function useFormField() {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);

  // Guard BEFORE calling getFieldState — if fieldContext.name is undefined
  // (context was never provided), getFieldState would throw or produce garbage.
  if (!fieldContext.name) {
    throw new Error('useFormField must be used within <FormField>');
  }

  const { getFieldState, formState } = useFormContext();
  const fieldState = getFieldState(fieldContext.name, formState);
  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
}

// FormItem wraps Base UI's Field.Root — provides accessibility wiring
const FormItem = React.forwardRef<
  React.ComponentRef<typeof Field.Root>,
  React.ComponentPropsWithoutRef<typeof Field.Root>
>(({ className, ...props }, ref) => {
  const id = React.useId();

  return (
    <FormItemContext.Provider value={{ id }}>
      <Field.Root
        ref={ref}
        className={cn('space-y-2', className)}
        {...props}
      />
    </FormItemContext.Provider>
  );
});
FormItem.displayName = 'FormItem';

// FormLabel uses our native Label + marks invalid fields, linked to its
// control via htmlFor/id (see useFormField's formItemId).
const FormLabel = React.forwardRef<
  React.ComponentRef<typeof Label>,
  React.ComponentPropsWithoutRef<typeof Label>
>(({ className, ...props }, ref) => {
  const { error, formItemId } = useFormField();

  return (
    <Label
      ref={ref}
      htmlFor={formItemId}
      className={cn(error && 'text-destructive', className)}
      {...props}
    />
  );
});
FormLabel.displayName = 'FormLabel';

// FormControl uses React.cloneElement (the original shadcn pattern) to inject
// a11y props into the consumer-provided child element. We avoid Base UI's
// Field.Control here because it renders a self-closing <input> and cannot
// accept React children — which crashes at SSR when a custom <Input> is passed.
const FormControl = React.forwardRef<
  HTMLElement,
  React.HTMLAttributes<HTMLElement> & { children: React.ReactElement }
>(({ children, ...props }, ref) => {
  const { error, formItemId, formDescriptionId, formMessageId } = useFormField();

  const childProps = {
    ref,
    id: formItemId,
    'aria-describedby': error
      ? `${formDescriptionId} ${formMessageId}`
      : formDescriptionId,
    'aria-invalid': !!error,
    ...props,
    ...(children.props as Record<string, unknown>),
  };

  return React.cloneElement(children, childProps);
});
FormControl.displayName = 'FormControl';

// FormDescription uses Base UI's Field.Description for a11y
const FormDescription = React.forwardRef<
  React.ComponentRef<typeof Field.Description>,
  React.ComponentPropsWithoutRef<typeof Field.Description>
>(({ className, ...props }, ref) => {
  const { formDescriptionId } = useFormField();

  return (
    <Field.Description
      ref={ref}
      id={formDescriptionId}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
});
FormDescription.displayName = 'FormDescription';

// FormMessage shows the validation error message from react-hook-form
const FormMessage = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => {
  const { error, formMessageId } = useFormField();
  const body = error ? String(error?.message ?? '') : children;

  if (!body) {
    return null;
  }

  return (
    <p
      ref={ref}
      id={formMessageId}
      className={cn('text-sm font-medium text-destructive', className)}
      {...props}
    >
      {body}
    </p>
  );
});
FormMessage.displayName = 'FormMessage';

export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
};
