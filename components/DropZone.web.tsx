import { createElement, type ReactNode } from 'react';

type DragEventLike = {
  preventDefault: () => void;
  dataTransfer?: { getData: (format: string) => string };
};

type Props = {
  onDropReminder: (reminderId: string) => void;
  children: ReactNode;
};

export default function DropZone({ onDropReminder, children }: Props) {
  return createElement(
    'div',
    {
      onDragOver: (event: DragEventLike) => event.preventDefault(),
      onDrop: (event: DragEventLike) => {
        event.preventDefault();
        const reminderId = event.dataTransfer?.getData('text/plain');
        if (reminderId) {
          onDropReminder(reminderId);
        }
      },
    },
    children
  );
}
