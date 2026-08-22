import type { ReactNode } from 'react';

type Props = {
  reminderId: string;
  children: ReactNode;
};

// No drag-and-drop on native — tap-to-assign (the project chip on each row)
// is the only way to move a task into a project there.
export default function DraggableRow({ children }: Props) {
  return <>{children}</>;
}
