/** Set by presence hook when profile status is do_not_disturb (mutes UI toasts). */
let presenceDnd = false;

export function setPresenceDnd(active) {
  presenceDnd = !!active;
}

export function getPresenceDnd() {
  return presenceDnd;
}
