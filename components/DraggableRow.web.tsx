import { createElement, type ReactNode } from 'react';

type DragEventLike = {
  dataTransfer?: { setData: (format: string, data: string) => void };
};

type Props = {
  reminderId: string;
  children: ReactNode;
};

export default function DraggableRow({ reminderId, children }: Props) {
  return createElement(
    'div',
    {
      draggable: true,
      onDragStart: (event: DragEventLike) => {
        event.dataTransfer?.setData('text/plain', reminderId);
      },
      style: { cursor: 'grab' },
    },
    children
  );
}
