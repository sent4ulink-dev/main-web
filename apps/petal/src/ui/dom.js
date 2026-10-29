// Tiny DOM helpers for the game UI (no framework needed for a few panels).

export function el(tag, className = "", text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(label, { className = "", ariaLabel, title, onClick } = {}) {
  const node = el("button", className, label);
  node.type = "button";
  if (ariaLabel) node.setAttribute("aria-label", ariaLabel);
  if (title) node.title = title;
  if (onClick) node.addEventListener("click", onClick);
  return node;
}

// A group of radio "chips": options = [[value, label], ...].
export function chipGroup(name, legend, options, current, onChange) {
  const field = el("fieldset", "chip-group");
  field.append(el("legend", "", legend));
  const row = el("div", "chips");
  const inputs = [];
  for (const [value, label] of options) {
    const id = `${name}-${value}`;
    const input = el("input");
    input.type = "radio";
    input.name = name;
    input.id = id;
    input.value = value;
    input.checked = value === current;
    input.addEventListener("change", () => input.checked && onChange(value));
    const tag = el("label", "chip", label);
    tag.htmlFor = id;
    row.append(input, tag);
    inputs.push(input);
  }
  field.append(row);
  return {
    element: field,
    set(value) {
      inputs.forEach((input) => (input.checked = input.value === value));
    },
  };
}

// A <dialog> that closes on backdrop click and Escape, restoring focus.
export function sheet(className, title) {
  const dialog = el("dialog", `sheet ${className}`);
  const heading = el("h2", "", title);
  heading.id = `${className}-title`;
  dialog.setAttribute("aria-labelledby", heading.id);
  const close = button("×", { className: "sheet-close", ariaLabel: "Close" });
  close.addEventListener("click", () => dialog.close());
  const body = el("div", "sheet-body");
  dialog.append(close, heading, body);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  let opener = null;
  dialog.addEventListener("close", () => opener?.focus?.());
  return {
    dialog,
    body,
    heading,
    open() {
      opener = document.activeElement;
      if (!dialog.open) dialog.showModal();
    },
    close() {
      if (dialog.open) dialog.close();
    },
  };
}
