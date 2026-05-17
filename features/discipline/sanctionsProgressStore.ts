/** In-memory queue for community-service hours approved by admin (mock simulation). */

type HoursEntry = {
  sanctionId: string;
  additionalHours: number;
};

const _queue: HoursEntry[] = [];

export const sanctionsProgressStore = {
  /** Enqueue hours to be added to a sanction's progress after admin approval. */
  enqueue(entry: HoursEntry): void {
    _queue.push(entry);
  },
  /** Drains and returns all queued entries (empties the queue). */
  drain(): HoursEntry[] {
    return _queue.splice(0);
  },
  peek(): readonly HoursEntry[] {
    return _queue;
  },
};
