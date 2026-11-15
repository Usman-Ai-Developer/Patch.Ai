def write_forms(components_dir, models):
    content = '''import React from 'react';
import { useForm } from 'react-hook-form';

const FIELD_TYPES = {
  CharField: 'text',
  EmailField: 'email',
  URLField: 'url',
  IntegerField: 'number',
  FloatField: 'number',
  BooleanField: 'checkbox',
  DateField: 'date',
  DateTimeField: 'datetime-local',
  PasswordField: 'password',
  TextField: 'textarea',
  ForeignKey: 'select',
  ManyToManyField: 'multi-select',
  ImageField: 'file',
  FileField: 'file',
};

export default function DynamicForm({ fields, defaultValues, onSubmit, submitText, disabled }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {fields.map((field) => {
        const type = FIELD_TYPES[field.type] || 'text';
        const isRequired = !field.options?.null && !field.options?.blank;
        const label = field.name.charAt(0).toUpperCase() + field.name.slice(1);
        const inputProps = {
          ...register(field.name, { required: isRequired }),
          className: 'w-full border rounded px-3 py-2 bg-surface text-text',
          disabled,
        };

        if (type === 'textarea') {
          return (
            <div key={field.name}>
              <label className="block text-sm font-medium">{label}</label>
              <textarea rows={4} {...inputProps} />
            </div>
          );
        }
        if (type === 'select') {
          return (
            <div key={field.name}>
              <label className="block text-sm font-medium">{label}</label>
              <select {...inputProps}>
                <option value="">Select…</option>
              </select>
            </div>
          );
        }
        if (type === 'checkbox') {
          return (
            <div key={field.name} className="flex items-center">
              <input type="checkbox" {...inputProps} className="mr-2" />
              <label className="text-sm">{label}</label>
            </div>
          );
        }
        return (
          <div key={field.name}>
            <label className="block text-sm font-medium">{label}</label>
            <input type={type} {...inputProps} />
          </div>
        );
      })}
      <button
        type="submit"
        disabled={disabled}
        className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark disabled:opacity-50"
      >
        {submitText || 'Save'}
      </button>
    </form>
  );
}
'''
    (components_dir / "DynamicForm.jsx").write_text(content, encoding='utf-8')