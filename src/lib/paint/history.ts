/**
 * Command-based history.
 *
 * Commands are opaque undo/redo closures, so structural edits (add/remove
 * layer) and pixel edits share one stack. Pixel commands only keep the dirty
 * bounding box of a finished stroke, never a full-document snapshot.
 */
export interface Command {
  label: string;
  undo: () => void;
  redo: () => void;
}

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  constructor(
    private readonly limit = 40,
    private readonly onChange: () => void = () => {},
  ) {}

  push(command: Command) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.onChange();
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    this.onChange();
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.redo();
    this.undoStack.push(cmd);
    this.onChange();
    return true;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.onChange();
  }
}
