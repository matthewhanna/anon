import type { ReactNode } from 'react';

type Props = {
  onDropReminder: (reminderId: string) => void;
  children: ReactNode;
};

// No drag-and-drop on native — nothing to drop onto here.
export default function DropZone({ children }: Props) {
  return <>{children}</>;
}
