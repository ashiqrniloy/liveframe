export interface RackData {
  containerId: string;
  sessionId: string;
  files: { name: string; status: string; operation: string }[];
}

export interface RackState {
  readonly tab: string;
  readonly draft: string;
}
