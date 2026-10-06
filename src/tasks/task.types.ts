export type TaskStatus = 'ACTIVE' | 'DONE';
export interface Task {
  id: number;
  userKey: string;
  chatKey: string;
  title: string;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
}
export interface TaskAttachment {
  id: string;
  taskId: number;
  originalName: string;
  mimeType: string;
  size: number;
  storageKey: string;
}
