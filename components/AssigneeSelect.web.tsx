import { createElement } from 'react';

type Option = { id: string; name: string };

type Props = {
  value: string;
  options: Option[];
  onChange: (id: string) => void;
};

export default function AssigneeSelect({ value, options, onChange }: Props) {
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
    options.map((option) => createElement('option', { key: option.id, value: option.id }, option.name))
  );
}
