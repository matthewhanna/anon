import { createElement } from 'react';

type Option = { id: string; name: string; is_individual: boolean };

type Props = {
  value: string;
  options: Option[];
  onChange: (id: string) => void;
};

export default function AssigneeSelect({ value, options, onChange }: Props) {
  const people = options.filter((option) => option.is_individual);
  const groups = options.filter((option) => !option.is_individual);

  const optionEl = (option: Option) => createElement('option', { key: option.id, value: option.id }, option.name);

  const children = [
    people.length > 0 && createElement('optgroup', { key: 'people', label: 'People' }, people.map(optionEl)),
    groups.length > 0 && createElement('optgroup', { key: 'groups', label: 'Groups' }, groups.map(optionEl)),
  ].filter(Boolean);

  return createElement(
    'select',
    {
      value,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
      style: {
        fontSize: 14,
        padding: '4px 6px',
        borderRadius: 6,
        border: '1px solid #8884',
        width: '100%',
        boxSizing: 'border-box',
      },
    },
    children
  );
}
