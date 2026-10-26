"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";
import { deleteTask, updateTask } from "@/app/(app)/tasks/actions";
import { DeleteConfirm } from "@/components/inventory/delete-confirm";
import { useEditsDisabled } from "@/components/inventory/edit-guard";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import type { TaskEntry } from "@/lib/tasks/queries";
import { TaskSummary } from "./proposal-card";
import { TaskForm } from "./task-form";

export function TaskRow({ task }: { task: TaskEntry }) {
  const [editing, setEditing] = useState(false);
  const editsDisabled = useEditsDisabled();
  return (
    <li className="flex items-start gap-2 py-3 pr-1 pl-4">
      <TaskSummary entry={task} />
      <div className="flex shrink-0 items-center">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground size-11"
          aria-label={`Edit ${task.name}`}
          onClick={() => setEditing(true)}
          disabled={editsDisabled}
        >
          <Pencil aria-hidden />
        </Button>
        <DeleteConfirm
          iconOnly
          triggerLabel={`Delete ${task.name}`}
          title={`Delete "${task.name}"?`}
          description="It will no longer be planned. This can't be undone."
          action={deleteTask.bind(null, task.id)}
        />
      </div>
      <ResponsiveDialog open={editing} onOpenChange={setEditing} title="Edit task">
        <TaskForm
          action={updateTask.bind(null, task.id)}
          onSuccess={() => setEditing(false)}
          defaults={task}
        />
      </ResponsiveDialog>
    </li>
  );
}
